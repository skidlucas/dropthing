import { describe, expect, it } from 'vitest';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  decrypt,
  createFileChunkIv,
  decryptFileChunked,
  decryptText,
  encodeEncryptedFileHeader,
  encrypt,
  encryptFileChunked,
  encryptText,
  exportKey,
  generateKey,
  importKey,
  parseEncryptedFileHeader,
  packFile,
  unpackFile,
} from '../crypto.js';

describe('crypto', () => {
  describe('encrypt/decrypt round-trip', () => {
    it('round-trips binary data', async () => {
      const key = await generateKey();
      const original = new Uint8Array([1, 2, 3, 4, 5, 72, 101, 108, 108, 111]);

      const ciphertext = await encrypt(key, original.buffer);
      const decrypted = await decrypt(key, ciphertext);

      expect(new Uint8Array(decrypted)).toEqual(original);
    });

    it('round-trips text', async () => {
      const key = await generateKey();
      const original = 'Hello, dropthing! 🔐';

      const ciphertext = await encryptText(key, original);
      const decrypted = await decryptText(key, ciphertext);

      expect(decrypted).toBe(original);
    });

    it('round-trips empty string', async () => {
      const key = await generateKey();

      const ciphertext = await encryptText(key, '');
      const decrypted = await decryptText(key, ciphertext);

      expect(decrypted).toBe('');
    });

    it('round-trips single byte', async () => {
      const key = await generateKey();
      const original = new Uint8Array([42]);

      const ciphertext = await encrypt(key, original.buffer);
      const decrypted = await decrypt(key, ciphertext);

      expect(new Uint8Array(decrypted)).toEqual(original);
    });
  });

  describe('key export/import', () => {
    it('round-trips a key through export and import', async () => {
      const key = await generateKey();
      const original = 'round-trip through key serialization';

      const exported = await exportKey(key);
      const imported = await importKey(exported);

      const ciphertext = await encryptText(key, original);
      const decrypted = await decryptText(imported, ciphertext);

      expect(decrypted).toBe(original);
    });

    it('exports to base64url format (no +, /, or = padding)', async () => {
      const key = await generateKey();
      const exported = await exportKey(key);

      expect(exported).not.toMatch(/[+/=]/);
      expect(exported.length).toBeGreaterThan(0);
    });
  });

  describe('IV uniqueness', () => {
    it('produces different ciphertext for the same plaintext', async () => {
      const key = await generateKey();
      const plaintext = 'same content encrypted twice';

      const ct1 = await encryptText(key, plaintext);
      const ct2 = await encryptText(key, plaintext);

      const b1 = arrayBufferToBase64(ct1);
      const b2 = arrayBufferToBase64(ct2);

      expect(b1).not.toBe(b2);
    });
  });

  describe('wrong key', () => {
    it('throws when decrypting with a different key', async () => {
      const key1 = await generateKey();
      const key2 = await generateKey();

      const ciphertext = await encryptText(key1, 'secret message');

      expect(decryptText(key2, ciphertext)).rejects.toThrow();
    });
  });

  describe('tampered ciphertext', () => {
    it('throws on GCM authentication failure', async () => {
      const key = await generateKey();
      const ciphertext = await encryptText(key, 'do not tamper');

      // Flip a byte in the ciphertext portion (after the 12-byte IV)
      const tampered = new Uint8Array(ciphertext);
      tampered[tampered.length - 1] ^= 0xff;

      expect(decryptText(key, tampered.buffer)).rejects.toThrow();
    });
  });

  describe('packFile/unpackFile', () => {
    it('round-trips filename and content', () => {
      const fileName = 'vacation-photos.jpg';
      const content = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

      const packed = packFile(fileName, content.buffer);
      const unpacked = unpackFile(packed);

      expect(unpacked.fileName).toBe(fileName);
      expect(unpacked.content).toEqual(content);
    });

    it('handles unicode filenames', () => {
      const fileName = 'données-été-2026.csv';
      const content = new Uint8Array([42]);

      const unpacked = unpackFile(packFile(fileName, content.buffer));

      expect(unpacked.fileName).toBe(fileName);
      expect(unpacked.content).toEqual(content);
    });

    it('round-trips through encrypt/decrypt', async () => {
      const key = await generateKey();
      const fileName = 'secret.pdf';
      const content = new Uint8Array([1, 2, 3, 4, 5]);

      const packed = packFile(fileName, content.buffer);
      const ciphertext = await encrypt(key, packed);
      const decrypted = await decrypt(key, ciphertext);
      const unpacked = unpackFile(decrypted);

      expect(unpacked.fileName).toBe(fileName);
      expect(unpacked.content).toEqual(content);
    });

    it('handles empty content', () => {
      const unpacked = unpackFile(packFile('empty.txt', new ArrayBuffer(0)));

      expect(unpacked.fileName).toBe('empty.txt');
      expect(unpacked.content.length).toBe(0);
    });
  });

  describe('chunked encrypted file container', () => {
    it('encodes and parses container metadata', () => {
      const baseIv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const header = encodeEncryptedFileHeader({
        fileName: 'large-秘密.bin',
        originalSize: 5_000_000_000,
        chunkSize: 1024,
        baseIv,
        chunkCiphertextLengths: [1040, 27],
      });

      const parsed = parseEncryptedFileHeader(header.buffer as ArrayBuffer);

      expect(parsed.version).toBe(1);
      expect(parsed.fileName).toBe('large-秘密.bin');
      expect(parsed.originalSize).toBe(5_000_000_000);
      expect(parsed.chunkSize).toBe(1024);
      expect(parsed.baseIv).toEqual(baseIv);
      expect(parsed.chunkCiphertextLengths).toEqual([1040, 27]);
      expect(parsed.headerLength).toBe(header.byteLength);
    });

    it('uses a random-prefix plus chunk-counter IV layout', () => {
      const baseIv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 99, 99, 99, 99]);

      expect(createFileChunkIv(baseIv, 0)).toEqual(
        new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0])
      );
      expect(createFileChunkIv(baseIv, 258)).toEqual(
        new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 1, 2])
      );
    });

    it('round-trips a file using forced small chunks', async () => {
      const key = await generateKey();
      const bytes = new Uint8Array(Array.from({ length: 25 }, (_, i) => i));
      const file = new File([bytes], 'chunked.bin', { type: 'application/octet-stream' });

      const encrypted = await encryptFileChunked(key, file, { chunkSize: 7 });
      const decrypted = await decryptFileChunked(key, encrypted);

      expect(decrypted.fileName).toBe('chunked.bin');
      expect(new Uint8Array(await decrypted.blob.arrayBuffer())).toEqual(bytes);
    });

    it('rejects tampered authenticated metadata', async () => {
      const key = await generateKey();
      const file = new File([new Uint8Array([1, 2, 3, 4, 5])], 'secret.bin');
      const encrypted = await encryptFileChunked(key, file, { chunkSize: 2 });
      const tampered = new Uint8Array(await encrypted.arrayBuffer());

      // Flip a bit in the original-size field. This header is used as AES-GCM AAD,
      // so decryption must fail before returning modified metadata/content.
      tampered[18] ^= 0xff;

      await expect(decryptFileChunked(key, tampered.buffer)).rejects.toThrow();
    });

    it('rejects reordered encrypted chunks', async () => {
      const key = await generateKey();
      const file = new File([new Uint8Array([1, 2, 3, 4])], 'ordered.bin');
      const encrypted = await encryptFileChunked(key, file, { chunkSize: 2 });
      const bytes = new Uint8Array(await encrypted.arrayBuffer());
      const header = parseEncryptedFileHeader(bytes.buffer as ArrayBuffer);
      const firstLength = header.chunkCiphertextLengths[0];
      const secondLength = header.chunkCiphertextLengths[1];
      const firstStart = header.headerLength;
      const secondStart = firstStart + firstLength;
      const reordered = new Uint8Array(bytes);

      reordered.set(bytes.slice(secondStart, secondStart + secondLength), firstStart);
      reordered.set(bytes.slice(firstStart, firstStart + firstLength), secondStart);

      await expect(decryptFileChunked(key, reordered.buffer)).rejects.toThrow();
    });

    it('round-trips an empty file', async () => {
      const key = await generateKey();
      const file = new File([], 'empty.dat');

      const encrypted = await encryptFileChunked(key, file, { chunkSize: 4 });
      const decrypted = await decryptFileChunked(key, encrypted);

      expect(decrypted.fileName).toBe('empty.dat');
      expect(decrypted.blob.size).toBe(0);
    });
  });

  describe('base64 helpers', () => {
    it('round-trips arrayBuffer through base64', () => {
      const original = new Uint8Array([0, 1, 127, 128, 255]);
      const encoded = arrayBufferToBase64(original.buffer);
      const decoded = base64ToArrayBuffer(encoded);

      expect(new Uint8Array(decoded)).toEqual(original);
    });
  });
});
