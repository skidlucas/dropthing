import { describe, expect, it } from 'vitest';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  decrypt,
  decryptText,
  encrypt,
  encryptText,
  exportKey,
  generateKey,
  importKey,
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

  describe('base64 helpers', () => {
    it('round-trips arrayBuffer through base64', () => {
      const original = new Uint8Array([0, 1, 127, 128, 255]);
      const encoded = arrayBufferToBase64(original.buffer);
      const decoded = base64ToArrayBuffer(encoded);

      expect(new Uint8Array(decoded)).toEqual(original);
    });
  });
});
