import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { DropJson } from '@dropthing/shared';
import { createDrop, uploadFile } from '@/lib/api';
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
    let uploadFileData = file;

    if (shouldEncrypt) {
      const key = await generateKey();
      keyFragment = await exportKey(key);
      const packed = packFile(file.name, await file.arrayBuffer());
      const ciphertext = await encrypt(key, packed);
      uploadFileData = new File([ciphertext], 'encrypted.bin', {
        type: 'application/octet-stream',
      });
    }

    const drop = await uploadFile(
      { file: uploadFileData, expiresIn: ttl, encrypted: shouldEncrypt },
      setProgress
    );

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
