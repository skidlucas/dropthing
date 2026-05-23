import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { DropJson } from '@dropthing/shared';
import {
  createDrop,
  presignUpload,
  uploadToPresigned,
  uploadStreamToPresigned,
  confirmUpload,
  supportsStreamingUpload,
} from '@/lib/api';
import {
  generateKey,
  exportKey,
  encryptText,
  arrayBufferToBase64,
  encryptFileChunked,
  encryptFileToReadableStream,
  estimateEncryptedFileSize,
} from '@/lib/crypto';

export interface UploadInput {
  mode: 'file' | 'text';
  ttl: number;
  file: File | null;
  content: string;
  encrypted: boolean;
  contentIsUrl: boolean;
}

interface UploadResult {
  drop: DropJson;
  keyFragment: string;
}

type ProgressSetter = (progress: number) => void;

async function performUpload(
  input: UploadInput,
  setProgress: ProgressSetter
): Promise<UploadResult> {
  const { mode, ttl, file, content, encrypted, contentIsUrl } = input;
  const type = contentIsUrl ? 'link' : mode;
  const shouldEncrypt = encrypted && !contentIsUrl;

  let keyFragment = '';

  if (mode === 'file' && file) {
    let fileName = file.name;
    let mimeType = file.type || 'application/octet-stream';
    let uploadSize = file.size;
    let key: CryptoKey | null = null;

    if (shouldEncrypt) {
      key = await generateKey();
      keyFragment = await exportKey(key);
      uploadSize = estimateEncryptedFileSize(file).encryptedSize;
      fileName = 'encrypted.bin';
      mimeType = 'application/octet-stream';
    }

    // 1. Get presigned URL from API
    const { uploadUrl, storageKey } = await presignUpload({
      fileName,
      mimeType,
      size: uploadSize,
      encrypted: shouldEncrypt,
    });

    // 2. Upload directly to R2
    if (shouldEncrypt && key) {
      if (supportsStreamingUpload()) {
        try {
          const { stream, encryptedSize } = await encryptFileToReadableStream(key, file);
          await uploadStreamToPresigned(uploadUrl, stream, mimeType, encryptedSize, setProgress);
        } catch {
          setProgress(0);
          const encryptedBlob = await encryptFileChunked(key, file);
          await uploadToPresigned(uploadUrl, encryptedBlob, mimeType, setProgress);
        }
      } else {
        const encryptedBlob = await encryptFileChunked(key, file);
        await uploadToPresigned(uploadUrl, encryptedBlob, mimeType, setProgress);
      }
    } else {
      await uploadToPresigned(uploadUrl, file, mimeType, setProgress);
    }

    // 3. Confirm upload and create drop record
    const drop = await confirmUpload({
      storageKey,
      fileName,
      mimeType,
      size: uploadSize,
      expiresIn: ttl,
      encrypted: shouldEncrypt,
    });

    return { drop, keyFragment };
  }

  // Text/link drops
  let uploadContent = content;

  if (shouldEncrypt) {
    const key = await generateKey();
    keyFragment = await exportKey(key);
    const ciphertext = await encryptText(key, content);
    uploadContent = arrayBufferToBase64(ciphertext);
  }

  const drop = await createDrop({
    type: type as 'text' | 'link',
    expiresIn: ttl,
    content: uploadContent,
    encrypted: shouldEncrypt,
  });

  return { drop, keyFragment };
}

export function useUploadDrop() {
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: (input: UploadInput) => performUpload(input, setProgress),
    onMutate: () => setProgress(0),
  });

  return {
    upload: mutation.mutate,
    result: mutation.data ?? null,
    uploading: mutation.isPending,
    progress,
    error: mutation.error
      ? mutation.error instanceof Error
        ? mutation.error.message
        : 'Upload failed'
      : null,
    reset: () => {
      mutation.reset();
      setProgress(0);
    },
  };
}
