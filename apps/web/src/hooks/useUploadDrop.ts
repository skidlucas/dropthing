import { useMutation } from '@tanstack/react-query';
import type { DropJson } from '@dropthing/shared';
import { createDrop } from '@/lib/api';
import {
  generateKey,
  exportKey,
  encrypt,
  encryptText,
  arrayBufferToBase64,
  packFile,
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

async function performUpload(input: UploadInput): Promise<UploadResult> {
  const { mode, ttl, file, content, encrypted, contentIsUrl } = input;
  const type = contentIsUrl ? 'link' : mode;
  const shouldEncrypt = encrypted && !contentIsUrl;

  let uploadFile = mode === 'file' ? (file ?? undefined) : undefined;
  let uploadContent = mode === 'text' ? content : undefined;
  let keyFragment = '';

  if (shouldEncrypt) {
    const key = await generateKey();
    keyFragment = await exportKey(key);

    if (mode === 'file' && file) {
      const packed = packFile(file.name, await file.arrayBuffer());
      const ciphertext = await encrypt(key, packed);
      uploadFile = new File([ciphertext], 'encrypted.bin', {
        type: 'application/octet-stream',
      });
    } else if (mode === 'text') {
      const ciphertext = await encryptText(key, content);
      uploadContent = arrayBufferToBase64(ciphertext);
    }
  }

  const drop = await createDrop({
    type,
    expiresIn: ttl,
    file: uploadFile,
    content: uploadContent,
    encrypted: shouldEncrypt,
  });

  return { drop, keyFragment };
}

export function useUploadDrop() {
  const mutation = useMutation({
    mutationFn: performUpload,
  });

  return {
    upload: mutation.mutate,
    result: mutation.data ?? null,
    uploading: mutation.isPending,
    error: mutation.error
      ? mutation.error instanceof Error
        ? mutation.error.message
        : 'Upload failed'
      : null,
    reset: mutation.reset,
  };
}
