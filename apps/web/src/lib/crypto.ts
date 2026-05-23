const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const FILE_NONCE_PREFIX_LENGTH = 8;
const DEFAULT_FILE_CHUNK_SIZE = 16 * 1024 * 1024;
const GCM_TAG_LENGTH = 16;
const FILE_CONTAINER_MAGIC = 'DTFENC2\0';
const FILE_CONTAINER_VERSION = 2;
const FILE_CONTAINER_FIXED_HEADER_SIZE = 8 + 1 + 2 + 8 + 4 + FILE_NONCE_PREFIX_LENGTH + 4;
const FILE_HEADER_TAG_COUNTER = 0xffffffff;
const MAX_FILE_CHUNK_INDEX = FILE_HEADER_TAG_COUNTER - 1;
const MAX_FILE_HEADER_SIZE = 16 * 1024 * 1024;

export interface EncryptedFileContainerHeader {
  version: number;
  fileName: string;
  originalSize: number;
  chunkSize: number;
  noncePrefix: Uint8Array;
  chunkCiphertextLengths: number[];
  headerTag: Uint8Array;
  headerWithoutTagLength: number;
  headerLength: number;
}

export interface EncryptedFileSize {
  encryptedSize: number;
  headerLength: number;
  chunkCount: number;
  chunkSize: number;
}

export interface EncryptedFileStream {
  stream: ReadableStream<Uint8Array>;
  encryptedSize: number;
}

export interface DecryptedFile {
  fileName: string;
  blob: Blob;
}

export interface DecryptedFileStream {
  fileName: string;
  originalSize: number;
  stream: ReadableStream<Uint8Array>;
}

interface EncryptedFilePlan {
  header: Uint8Array;
  encryptedSize: number;
  chunkSize: number;
  noncePrefix: Uint8Array;
  chunkCiphertextLengths: number[];
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

export function estimateEncryptedFileSize(
  file: Pick<File, 'name' | 'size'>,
  options: { chunkSize?: number } = {}
): EncryptedFileSize {
  const chunkSize = normalizeFileChunkSize(options.chunkSize);
  const nameBytes = new TextEncoder().encode(file.name);
  if (nameBytes.length > 0xffff) throw new Error('Filename is too long');
  const chunkCount = calculateFileChunkCount(file.size, chunkSize);
  const headerLength =
    FILE_CONTAINER_FIXED_HEADER_SIZE + nameBytes.length + chunkCount * 4 + GCM_TAG_LENGTH;
  if (headerLength > MAX_FILE_HEADER_SIZE) throw new Error('Encrypted file header is too large');
  const encryptedSize = headerLength + file.size + chunkCount * GCM_TAG_LENGTH;
  if (!Number.isSafeInteger(encryptedSize)) throw new Error('Encrypted file is too large');
  return { encryptedSize, headerLength, chunkCount, chunkSize };
}

export function createFileChunkIv(noncePrefix: Uint8Array, chunkIndex: number): Uint8Array {
  if (noncePrefix.length !== FILE_NONCE_PREFIX_LENGTH)
    throw new Error('Invalid nonce prefix length');
  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > MAX_FILE_CHUNK_INDEX) {
    throw new Error('Invalid chunk index');
  }

  // 96-bit AES-GCM nonce: [64-bit random prefix][32-bit chunk counter].
  // 0xffffffff is reserved for the header authentication tag.
  const iv = new Uint8Array(IV_LENGTH);
  iv.set(noncePrefix, 0);
  new DataView(iv.buffer).setUint32(FILE_NONCE_PREFIX_LENGTH, chunkIndex, false);
  return iv;
}

export async function encodeEncryptedFileHeader(
  key: CryptoKey,
  params: {
    fileName: string;
    originalSize: number;
    chunkSize: number;
    noncePrefix: Uint8Array;
    chunkCiphertextLengths: number[];
  }
): Promise<Uint8Array> {
  const headerWithoutTag = encodeEncryptedFileHeaderWithoutTag(params);
  const headerTag = await createEncryptedFileHeaderTag(key, params.noncePrefix, headerWithoutTag);
  const header = new Uint8Array(headerWithoutTag.byteLength + headerTag.byteLength);
  header.set(headerWithoutTag, 0);
  header.set(headerTag, headerWithoutTag.byteLength);
  return header;
}

export function parseEncryptedFileHeader(data: ArrayBuffer): EncryptedFileContainerHeader {
  const bytes = new Uint8Array(data);
  if (bytes.length < FILE_CONTAINER_FIXED_HEADER_SIZE) {
    throw new Error('Invalid encrypted file container');
  }

  const magic = new TextDecoder().decode(bytes.slice(0, 8));
  if (magic !== FILE_CONTAINER_MAGIC) throw new Error('Invalid encrypted file container');

  const view = new DataView(data);
  const version = view.getUint8(8);
  if (version !== FILE_CONTAINER_VERSION) throw new Error('Unsupported encrypted file version');

  const nameLen = view.getUint16(9, false);
  const originalSize = getUint64(view, 11);
  const chunkSize = view.getUint32(19, false);
  if (chunkSize <= 0) throw new Error('Invalid encrypted file chunk size');

  const noncePrefix = bytes.slice(23, 23 + FILE_NONCE_PREFIX_LENGTH);
  const chunkCount = view.getUint32(31, false);
  const expectedChunkCount = calculateFileChunkCount(originalSize, chunkSize);
  if (chunkCount !== expectedChunkCount) throw new Error('Invalid encrypted file chunk count');

  const headerWithoutTagLength = FILE_CONTAINER_FIXED_HEADER_SIZE + nameLen + chunkCount * 4;
  const headerLength = headerWithoutTagLength + GCM_TAG_LENGTH;
  if (headerLength > MAX_FILE_HEADER_SIZE) throw new Error('Encrypted file header is too large');
  if (bytes.length < headerLength) throw new Error('Truncated encrypted file container');

  const fileName = new TextDecoder().decode(
    bytes.slice(FILE_CONTAINER_FIXED_HEADER_SIZE, FILE_CONTAINER_FIXED_HEADER_SIZE + nameLen)
  );
  const chunkCiphertextLengths: number[] = [];
  let offset = FILE_CONTAINER_FIXED_HEADER_SIZE + nameLen;
  for (let i = 0; i < chunkCount; i += 1) {
    const length = view.getUint32(offset, false);
    const expectedLength = getFilePlaintextChunkLength(originalSize, chunkSize, i) + GCM_TAG_LENGTH;
    if (length !== expectedLength) throw new Error('Invalid encrypted file chunk length');
    chunkCiphertextLengths.push(length);
    offset += 4;
  }
  const headerTag = bytes.slice(headerWithoutTagLength, headerLength);

  return {
    version,
    fileName,
    originalSize,
    chunkSize,
    noncePrefix,
    chunkCiphertextLengths,
    headerTag,
    headerWithoutTagLength,
    headerLength,
  };
}

export async function readEncryptedFileHeader(
  key: CryptoKey,
  stream: ReadableStream<Uint8Array>
): Promise<EncryptedFileContainerHeader> {
  const source = new BufferedStreamReader(stream.getReader());
  try {
    const { header, headerBytes } = await readAndVerifyEncryptedFileHeader(key, source);
    await source.cancel('encrypted file header read');
    // Ensure returned byte arrays are detached from the temporary read buffer.
    return {
      ...header,
      noncePrefix: new Uint8Array(header.noncePrefix),
      headerTag: new Uint8Array(header.headerTag),
      chunkCiphertextLengths: [...header.chunkCiphertextLengths],
      headerLength: headerBytes.byteLength,
    };
  } catch (error) {
    await source.cancel(error).catch(() => undefined);
    throw error;
  }
}

export async function encryptFileToReadableStream(
  key: CryptoKey,
  file: File,
  options: { chunkSize?: number } = {}
): Promise<EncryptedFileStream> {
  const plan = await createEncryptedFilePlan(key, file, options);
  let sentHeader = false;
  let offset = 0;
  let index = 0;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sentHeader) {
        controller.enqueue(plan.header);
        sentHeader = true;
        return;
      }

      if (offset >= file.size) {
        controller.close();
        return;
      }

      const plaintext = await file
        .slice(offset, Math.min(offset + plan.chunkSize, file.size))
        .arrayBuffer();
      const ciphertext = await encryptFileChunk(key, plan, index, plaintext);
      controller.enqueue(new Uint8Array(ciphertext));
      offset += plan.chunkSize;
      index += 1;
    },
  });

  return { stream, encryptedSize: plan.encryptedSize };
}

export async function encryptFileChunked(
  key: CryptoKey,
  file: File,
  options: { chunkSize?: number } = {}
): Promise<Blob> {
  const { stream } = await encryptFileToReadableStream(key, file, options);
  const blob = await new Response(stream).blob();
  return blob.slice(0, blob.size, 'application/octet-stream');
}

export async function decryptFileStream(
  key: CryptoKey,
  stream: ReadableStream<Uint8Array>
): Promise<DecryptedFileStream> {
  const source = new BufferedStreamReader(stream.getReader());
  let headerData: { header: EncryptedFileContainerHeader; headerBytes: Uint8Array };
  try {
    headerData = await readAndVerifyEncryptedFileHeader(key, source);
  } catch (error) {
    await source.cancel(error).catch(() => undefined);
    throw error;
  }

  const { header, headerBytes } = headerData;
  let index = 0;
  let plaintextSize = 0;

  const decryptedStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (index >= header.chunkCiphertextLengths.length) {
          if (plaintextSize !== header.originalSize) throw new Error('Invalid decrypted file size');
          if (await source.hasTrailingBytes())
            throw new Error('Invalid encrypted file trailing data');
          controller.close();
          return;
        }

        const length = header.chunkCiphertextLengths[index];
        const ciphertext = await source.readExactly(length);
        const plaintext = await crypto.subtle.decrypt(
          {
            name: ALGORITHM,
            iv: createFileChunkIv(header.noncePrefix, index) as BufferSource,
            additionalData: createFileChunkAad(headerBytes, index),
          },
          key,
          ciphertext as BufferSource
        );
        plaintextSize += plaintext.byteLength;
        controller.enqueue(new Uint8Array(plaintext));
        index += 1;
      } catch (error) {
        await source.cancel(error).catch(() => undefined);
        controller.error(error);
      }
    },
    async cancel(reason) {
      await source.cancel(reason);
    },
  });

  return {
    fileName: header.fileName,
    originalSize: header.originalSize,
    stream: decryptedStream,
  };
}

export async function decryptFileChunked(
  key: CryptoKey,
  data: ArrayBuffer | Blob
): Promise<DecryptedFile> {
  const container = data instanceof Blob ? data : new Blob([data]);
  const decrypted = await decryptFileStream(key, container.stream());
  const blob = await new Response(decrypted.stream).blob();
  if (blob.size !== decrypted.originalSize) throw new Error('Invalid decrypted file size');
  return { fileName: decrypted.fileName, blob };
}

async function createEncryptedFilePlan(
  key: CryptoKey,
  file: File,
  options: { chunkSize?: number }
): Promise<EncryptedFilePlan> {
  const size = estimateEncryptedFileSize(file, options);
  const noncePrefix = crypto.getRandomValues(new Uint8Array(FILE_NONCE_PREFIX_LENGTH));
  const chunkCiphertextLengths = buildFileChunkCiphertextLengths(file.size, size.chunkSize);
  const header = await encodeEncryptedFileHeader(key, {
    fileName: file.name,
    originalSize: file.size,
    chunkSize: size.chunkSize,
    noncePrefix,
    chunkCiphertextLengths,
  });
  if (header.byteLength !== size.headerLength)
    throw new Error('Unexpected encrypted header length');

  return {
    header,
    encryptedSize: size.encryptedSize,
    chunkSize: size.chunkSize,
    noncePrefix,
    chunkCiphertextLengths,
  };
}

async function encryptFileChunk(
  key: CryptoKey,
  plan: EncryptedFilePlan,
  index: number,
  plaintext: ArrayBuffer
): Promise<ArrayBuffer> {
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: createFileChunkIv(plan.noncePrefix, index) as BufferSource,
      additionalData: createFileChunkAad(plan.header, index),
    },
    key,
    plaintext
  );
  if (ciphertext.byteLength !== plan.chunkCiphertextLengths[index]) {
    throw new Error('Unexpected encrypted chunk length');
  }
  return ciphertext;
}

function encodeEncryptedFileHeaderWithoutTag(params: {
  fileName: string;
  originalSize: number;
  chunkSize: number;
  noncePrefix: Uint8Array;
  chunkCiphertextLengths: number[];
}): Uint8Array {
  const nameBytes = new TextEncoder().encode(params.fileName);
  if (nameBytes.length > 0xffff) throw new Error('Filename is too long');
  if (params.noncePrefix.length !== FILE_NONCE_PREFIX_LENGTH) {
    throw new Error('Invalid nonce prefix length');
  }

  const expectedChunkCount = calculateFileChunkCount(params.originalSize, params.chunkSize);
  if (params.chunkCiphertextLengths.length !== expectedChunkCount) {
    throw new Error('Invalid encrypted file chunk count');
  }

  const header = new Uint8Array(
    FILE_CONTAINER_FIXED_HEADER_SIZE + nameBytes.length + params.chunkCiphertextLengths.length * 4
  );
  const view = new DataView(header.buffer);
  header.set(new TextEncoder().encode(FILE_CONTAINER_MAGIC), 0);
  view.setUint8(8, FILE_CONTAINER_VERSION);
  view.setUint16(9, nameBytes.length, false);
  setUint64(view, 11, params.originalSize);
  view.setUint32(19, params.chunkSize, false);
  header.set(params.noncePrefix, 23);
  view.setUint32(31, params.chunkCiphertextLengths.length, false);
  header.set(nameBytes, FILE_CONTAINER_FIXED_HEADER_SIZE);

  let offset = FILE_CONTAINER_FIXED_HEADER_SIZE + nameBytes.length;
  for (let index = 0; index < params.chunkCiphertextLengths.length; index += 1) {
    const length = params.chunkCiphertextLengths[index];
    const expectedLength =
      getFilePlaintextChunkLength(params.originalSize, params.chunkSize, index) + GCM_TAG_LENGTH;
    if (length !== expectedLength) throw new Error('Invalid encrypted file chunk length');
    view.setUint32(offset, length, false);
    offset += 4;
  }
  return header;
}

async function createEncryptedFileHeaderTag(
  key: CryptoKey,
  noncePrefix: Uint8Array,
  headerWithoutTag: Uint8Array
): Promise<Uint8Array> {
  const tag = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: createFileHeaderIv(noncePrefix) as BufferSource,
      additionalData: headerWithoutTag as BufferSource,
    },
    key,
    new ArrayBuffer(0)
  );
  if (tag.byteLength !== GCM_TAG_LENGTH) throw new Error('Unexpected encrypted header tag length');
  return new Uint8Array(tag);
}

async function verifyEncryptedFileHeader(
  key: CryptoKey,
  headerBytes: Uint8Array,
  header: EncryptedFileContainerHeader
): Promise<void> {
  const headerWithoutTag = headerBytes.slice(0, header.headerWithoutTagLength);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: createFileHeaderIv(header.noncePrefix) as BufferSource,
      additionalData: headerWithoutTag as BufferSource,
    },
    key,
    header.headerTag as BufferSource
  );
  if (plaintext.byteLength !== 0) throw new Error('Invalid encrypted file header');
}

async function readAndVerifyEncryptedFileHeader(
  key: CryptoKey,
  source: BufferedStreamReader
): Promise<{ header: EncryptedFileContainerHeader; headerBytes: Uint8Array }> {
  const fixedHeader = await source.readExactly(FILE_CONTAINER_FIXED_HEADER_SIZE);
  const fixedView = new DataView(
    fixedHeader.buffer,
    fixedHeader.byteOffset,
    fixedHeader.byteLength
  );
  const nameLen = fixedView.getUint16(9, false);
  const chunkCount = fixedView.getUint32(31, false);
  const headerLength = FILE_CONTAINER_FIXED_HEADER_SIZE + nameLen + chunkCount * 4 + GCM_TAG_LENGTH;
  if (headerLength > MAX_FILE_HEADER_SIZE) throw new Error('Encrypted file header is too large');
  const rest = await source.readExactly(headerLength - FILE_CONTAINER_FIXED_HEADER_SIZE);
  const headerBytes = concatBytes(fixedHeader, rest);
  const header = parseEncryptedFileHeader(headerBytes.buffer as ArrayBuffer);
  await verifyEncryptedFileHeader(key, headerBytes, header);
  return { header, headerBytes };
}

function createFileHeaderIv(noncePrefix: Uint8Array): Uint8Array {
  if (noncePrefix.length !== FILE_NONCE_PREFIX_LENGTH)
    throw new Error('Invalid nonce prefix length');
  const iv = new Uint8Array(IV_LENGTH);
  iv.set(noncePrefix, 0);
  new DataView(iv.buffer).setUint32(FILE_NONCE_PREFIX_LENGTH, FILE_HEADER_TAG_COUNTER, false);
  return iv;
}

function createFileChunkAad(header: Uint8Array, chunkIndex: number): BufferSource {
  const aad = new Uint8Array(header.byteLength + 4);
  aad.set(header, 0);
  new DataView(aad.buffer).setUint32(header.byteLength, chunkIndex, false);
  return aad as BufferSource;
}

function normalizeFileChunkSize(chunkSize = DEFAULT_FILE_CHUNK_SIZE): number {
  if (
    !Number.isSafeInteger(chunkSize) ||
    chunkSize <= 0 ||
    chunkSize > 0xffffffff - GCM_TAG_LENGTH
  ) {
    throw new Error('Invalid chunk size');
  }
  return chunkSize;
}

function calculateFileChunkCount(size: number, chunkSize: number): number {
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('Invalid file size');
  const normalizedChunkSize = normalizeFileChunkSize(chunkSize);
  const chunkCount = Math.ceil(size / normalizedChunkSize);
  if (chunkCount > MAX_FILE_CHUNK_INDEX + 1) throw new Error('File has too many chunks');
  return chunkCount;
}

function buildFileChunkCiphertextLengths(size: number, chunkSize: number): number[] {
  const chunkCount = calculateFileChunkCount(size, chunkSize);
  return Array.from({ length: chunkCount }, (_, index) => {
    return getFilePlaintextChunkLength(size, chunkSize, index) + GCM_TAG_LENGTH;
  });
}

function getFilePlaintextChunkLength(size: number, chunkSize: number, index: number): number {
  const chunkStart = index * chunkSize;
  if (chunkStart >= size) throw new Error('Invalid chunk index');
  return Math.min(chunkSize, size - chunkStart);
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

class BufferedStreamReader {
  private readonly buffers: Uint8Array[] = [];
  private bufferedLength = 0;

  constructor(private readonly reader: ReadableStreamDefaultReader<Uint8Array>) {}

  async readExactly(length: number): Promise<Uint8Array> {
    if (!Number.isSafeInteger(length) || length < 0) throw new Error('Invalid read length');
    const output = new Uint8Array(length);
    let written = 0;

    while (written < length) {
      if (this.buffers.length === 0) {
        const { done, value } = await this.reader.read();
        if (done || !value) throw new Error('Truncated encrypted file container');
        if (value.byteLength === 0) continue;
        this.buffers.push(value);
        this.bufferedLength += value.byteLength;
      }

      const chunk = this.buffers[0];
      const take = Math.min(length - written, chunk.byteLength);
      output.set(chunk.subarray(0, take), written);
      written += take;
      this.bufferedLength -= take;

      if (take === chunk.byteLength) {
        this.buffers.shift();
      } else {
        this.buffers[0] = chunk.subarray(take);
      }
    }

    return output;
  }

  async hasTrailingBytes(): Promise<boolean> {
    if (this.bufferedLength > 0) return true;

    while (true) {
      const { done, value } = await this.reader.read();
      if (done) return false;
      if (value && value.byteLength > 0) return true;
    }
  }

  cancel(reason?: unknown): Promise<void> {
    return this.reader.cancel(reason);
  }
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
