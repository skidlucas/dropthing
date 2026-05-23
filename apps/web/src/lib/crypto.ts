const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const DEFAULT_FILE_CHUNK_SIZE = 16 * 1024 * 1024;
const FILE_CONTAINER_MAGIC = 'DTFENC1\0';
const FILE_CONTAINER_VERSION = 1;
const FILE_CONTAINER_HEADER_SIZE = 8 + 1 + 2 + 8 + 4 + 12 + 4;

export interface EncryptedFileContainerHeader {
  version: number;
  fileName: string;
  originalSize: number;
  chunkSize: number;
  baseIv: Uint8Array;
  chunkCiphertextLengths: number[];
  headerLength: number;
}

export interface DecryptedFile {
  fileName: string;
  blob: Blob;
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGORITHM, length: KEY_LENGTH }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encrypt(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data);

  // Prepend IV to ciphertext: [IV (12 bytes) | ciphertext + auth tag]
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);
  return result.buffer;
}

export async function decrypt(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(data);
  const iv = bytes.slice(0, IV_LENGTH);
  const ciphertext = bytes.slice(IV_LENGTH);
  return crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return base64UrlEncode(new Uint8Array(raw));
}

export async function importKey(encoded: string): Promise<CryptoKey> {
  const raw = base64UrlDecode(encoded);
  return crypto.subtle.importKey(
    'raw',
    raw.buffer as ArrayBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['decrypt']
  );
}

export function encryptText(key: CryptoKey, text: string): Promise<ArrayBuffer> {
  return encrypt(key, new TextEncoder().encode(text).buffer);
}

export async function decryptText(key: CryptoKey, data: ArrayBuffer): Promise<string> {
  const plaintext = await decrypt(key, data);
  return new TextDecoder().decode(plaintext);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return bytes.buffer;
}

/** Pack filename + content into a single buffer: [2-byte name length][UTF-8 name][content] */
export function packFile(fileName: string, content: ArrayBuffer): ArrayBuffer {
  const nameBytes = new TextEncoder().encode(fileName);
  const packed = new Uint8Array(2 + nameBytes.length + content.byteLength);
  packed[0] = (nameBytes.length >> 8) & 0xff;
  packed[1] = nameBytes.length & 0xff;
  packed.set(nameBytes, 2);
  packed.set(new Uint8Array(content), 2 + nameBytes.length);
  return packed.buffer;
}

/** Unpack filename + content from a decrypted buffer */
export function unpackFile(data: ArrayBuffer): { fileName: string; content: Uint8Array } {
  const bytes = new Uint8Array(data);
  const nameLen = (bytes[0] << 8) | bytes[1];
  const fileName = new TextDecoder().decode(bytes.slice(2, 2 + nameLen));
  const content = bytes.slice(2 + nameLen);
  return { fileName, content };
}

export function createFileChunkIv(baseIv: Uint8Array, chunkIndex: number): Uint8Array {
  if (baseIv.length !== IV_LENGTH) throw new Error('Invalid base IV length');
  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 0xffffffff) {
    throw new Error('Invalid chunk index');
  }

  // 96-bit AES-GCM nonce: [64-bit random prefix][32-bit chunk counter].
  // The last 32 bits of baseIv are intentionally ignored to make the layout explicit.
  const iv = new Uint8Array(IV_LENGTH);
  iv.set(baseIv.slice(0, 8), 0);
  new DataView(iv.buffer).setUint32(8, chunkIndex, false);
  return iv;
}

export function encodeEncryptedFileHeader(params: {
  fileName: string;
  originalSize: number;
  chunkSize: number;
  baseIv: Uint8Array;
  chunkCiphertextLengths: number[];
}): Uint8Array {
  const nameBytes = new TextEncoder().encode(params.fileName);
  if (nameBytes.length > 0xffff) throw new Error('Filename is too long');
  if (params.baseIv.length !== IV_LENGTH) throw new Error('Invalid base IV length');

  const header = new Uint8Array(
    FILE_CONTAINER_HEADER_SIZE + nameBytes.length + params.chunkCiphertextLengths.length * 4
  );
  const view = new DataView(header.buffer);
  header.set(new TextEncoder().encode(FILE_CONTAINER_MAGIC), 0);
  view.setUint8(8, FILE_CONTAINER_VERSION);
  view.setUint16(9, nameBytes.length, false);
  setUint64(view, 11, params.originalSize);
  view.setUint32(19, params.chunkSize, false);
  header.set(params.baseIv, 23);
  view.setUint32(35, params.chunkCiphertextLengths.length, false);
  header.set(nameBytes, FILE_CONTAINER_HEADER_SIZE);
  let offset = FILE_CONTAINER_HEADER_SIZE + nameBytes.length;
  for (const length of params.chunkCiphertextLengths) {
    view.setUint32(offset, length, false);
    offset += 4;
  }
  return header;
}

export function parseEncryptedFileHeader(data: ArrayBuffer): EncryptedFileContainerHeader {
  const bytes = new Uint8Array(data);
  if (bytes.length < FILE_CONTAINER_HEADER_SIZE)
    throw new Error('Invalid encrypted file container');
  const magic = new TextDecoder().decode(bytes.slice(0, 8));
  if (magic !== FILE_CONTAINER_MAGIC) throw new Error('Invalid encrypted file container');
  const view = new DataView(data);
  const version = view.getUint8(8);
  if (version !== FILE_CONTAINER_VERSION) throw new Error('Unsupported encrypted file version');
  const nameLen = view.getUint16(9, false);
  const originalSize = getUint64(view, 11);
  const chunkSize = view.getUint32(19, false);
  const baseIv = bytes.slice(23, 35);
  const chunkCount = view.getUint32(35, false);
  const headerLength = FILE_CONTAINER_HEADER_SIZE + nameLen + chunkCount * 4;
  if (bytes.length < headerLength) throw new Error('Truncated encrypted file container');
  const fileName = new TextDecoder().decode(
    bytes.slice(FILE_CONTAINER_HEADER_SIZE, FILE_CONTAINER_HEADER_SIZE + nameLen)
  );
  const chunkCiphertextLengths: number[] = [];
  let offset = FILE_CONTAINER_HEADER_SIZE + nameLen;
  for (let i = 0; i < chunkCount; i += 1) {
    chunkCiphertextLengths.push(view.getUint32(offset, false));
    offset += 4;
  }
  return {
    version,
    fileName,
    originalSize,
    chunkSize,
    baseIv,
    chunkCiphertextLengths,
    headerLength,
  };
}

export async function encryptFileChunked(
  key: CryptoKey,
  file: File,
  options: { chunkSize?: number } = {}
): Promise<Blob> {
  const chunkSize = options.chunkSize ?? DEFAULT_FILE_CHUNK_SIZE;
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) throw new Error('Invalid chunk size');
  const baseIv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const chunkCount = Math.ceil(file.size / chunkSize);
  if (chunkCount > 0xffffffff) throw new Error('File has too many chunks');
  const chunkCiphertextLengths = Array.from({ length: chunkCount }, (_, index) => {
    const plaintextLength = Math.min(chunkSize, file.size - index * chunkSize);
    return plaintextLength + 16;
  });
  const header = encodeEncryptedFileHeader({
    fileName: file.name,
    originalSize: file.size,
    chunkSize,
    baseIv,
    chunkCiphertextLengths,
  });
  const encryptedChunks: BlobPart[] = [];

  for (let offset = 0, index = 0; offset < file.size; offset += chunkSize, index += 1) {
    const plaintext = await file
      .slice(offset, Math.min(offset + chunkSize, file.size))
      .arrayBuffer();
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: createFileChunkIv(baseIv, index) as BufferSource,
        additionalData: createFileChunkAad(header, index),
      },
      key,
      plaintext
    );
    if (ciphertext.byteLength !== chunkCiphertextLengths[index]) {
      throw new Error('Unexpected encrypted chunk length');
    }
    encryptedChunks.push(ciphertext);
  }

  return new Blob([header.buffer as ArrayBuffer, ...encryptedChunks], {
    type: 'application/octet-stream',
  });
}

export async function decryptFileChunked(
  key: CryptoKey,
  data: ArrayBuffer | Blob
): Promise<DecryptedFile> {
  const container = data instanceof Blob ? data : new Blob([data]);
  const fixedHeader = await container.slice(0, FILE_CONTAINER_HEADER_SIZE).arrayBuffer();
  const fixed = new Uint8Array(fixedHeader);
  if (fixed.length < FILE_CONTAINER_HEADER_SIZE)
    throw new Error('Invalid encrypted file container');
  const fixedView = new DataView(fixedHeader);
  const nameLen = fixedView.getUint16(9, false);
  const chunkCount = fixedView.getUint32(35, false);
  const headerLength = FILE_CONTAINER_HEADER_SIZE + nameLen + chunkCount * 4;
  const headerBuffer = await container.slice(0, headerLength).arrayBuffer();
  const header = parseEncryptedFileHeader(headerBuffer);
  const headerBytes = new Uint8Array(headerBuffer);
  const plaintextParts: BlobPart[] = [];
  let offset = header.headerLength;
  for (let index = 0; index < header.chunkCiphertextLengths.length; index += 1) {
    const length = header.chunkCiphertextLengths[index];
    const ciphertext = await container.slice(offset, offset + length).arrayBuffer();
    const plaintext = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: createFileChunkIv(header.baseIv, index) as BufferSource,
        additionalData: createFileChunkAad(headerBytes, index),
      },
      key,
      ciphertext
    );
    plaintextParts.push(plaintext);
    offset += length;
  }
  const blob = new Blob(plaintextParts);
  if (blob.size !== header.originalSize) throw new Error('Invalid decrypted file size');
  return { fileName: header.fileName, blob };
}

function createFileChunkAad(header: Uint8Array, chunkIndex: number): BufferSource {
  const aad = new Uint8Array(header.byteLength + 4);
  aad.set(header, 0);
  new DataView(aad.buffer).setUint32(header.byteLength, chunkIndex, false);
  return aad as BufferSource;
}

function setUint64(view: DataView, offset: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid 64-bit value');
  view.setUint32(offset, Math.floor(value / 0x100000000), false);
  view.setUint32(offset + 4, value >>> 0, false);
}

function getUint64(view: DataView, offset: number): number {
  const value = view.getUint32(offset, false) * 0x100000000 + view.getUint32(offset + 4, false);
  if (!Number.isSafeInteger(value)) throw new Error('Unsafe 64-bit value');
  return value;
}

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
