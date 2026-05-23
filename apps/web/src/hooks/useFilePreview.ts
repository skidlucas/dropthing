import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DropJson } from '@dropthing/shared';
import { getFileUrl } from '@/lib/api';
import { importKey, decryptFileChunked } from '@/lib/crypto';
import { getPreviewType, mimeFromExtension, type PreviewType } from '@/lib/preview';

interface FilePreviewData {
  previewUrl: string;
  previewType: PreviewType;
  decryptedFileName: string | null;
  isBlobUrl: boolean;
}

async function buildPreview(
  drop: DropJson,
  id: string,
  keyString: string
): Promise<FilePreviewData | null> {
  // Non-encrypted: use file URL directly
  if (!drop.encrypted && drop.mimeType) {
    const type = getPreviewType(drop.mimeType);
    if (type) {
      return {
        previewUrl: getFileUrl(id),
        previewType: type,
        decryptedFileName: null,
        isBlobUrl: false,
      };
    }
    return null;
  }

  // Encrypted: decrypt to recover filename + build preview
  if (drop.encrypted && keyString) {
    const res = await fetch(getFileUrl(id));
    const ciphertext = await res.blob();
    const key = await importKey(keyString);
    const { fileName, blob: contentBlob } = await decryptFileChunked(key, ciphertext);
    const mime = mimeFromExtension(fileName);
    const type = mime ? getPreviewType(mime) : null;

    if (type && mime) {
      const blob = contentBlob.slice(0, contentBlob.size, mime);
      return {
        previewUrl: URL.createObjectURL(blob),
        previewType: type,
        decryptedFileName: fileName,
        isBlobUrl: true,
      };
    }

    // Not previewable but we still have the filename
    return { previewUrl: '', previewType: 'image', decryptedFileName: fileName, isBlobUrl: false };
  }

  return null;
}

export function useFilePreview(drop: DropJson | null, id: string, keyString: string) {
  const isFileDrop = drop?.type === 'file';

  const { data, isLoading } = useQuery({
    queryKey: ['drop', id, 'preview'],
    queryFn: () => buildPreview(drop!, id, keyString),
    enabled: isFileDrop === true,
  });

  // Cleanup blob URLs on unmount or when data changes
  useEffect(() => {
    return () => {
      if (data?.isBlobUrl && data.previewUrl) {
        URL.revokeObjectURL(data.previewUrl);
      }
    };
  }, [data]);

  const hasPreview = data?.previewUrl && data.previewType;

  return {
    previewUrl: hasPreview ? data.previewUrl : null,
    previewType: hasPreview ? data.previewType : null,
    isLoading: isFileDrop === true && isLoading,
    decryptedFileName: data?.decryptedFileName ?? null,
  };
}
