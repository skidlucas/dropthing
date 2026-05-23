import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DropJson } from '@dropthing/shared';
import { getFileUrl } from '@/lib/api';
import { importKey, decryptFileChunked } from '@/lib/crypto';
import { getPreviewType, mimeFromExtension, type PreviewType } from '@/lib/preview';

const MAX_ENCRYPTED_PREVIEW_SIZE = 100 * 1024 * 1024;

interface FilePreviewData {
  previewUrl: string;
  previewType: PreviewType | null;
  decryptedFileName: string | null;
  isBlobUrl: boolean;
  previewUnavailableReason: string | null;
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
        previewUnavailableReason: null,
      };
    }
    return null;
  }

  // Encrypted previews require full client-side decryption before the browser can
  // display them. Avoid fetching/decrypting large encrypted files just for preview.
  if (drop.encrypted && keyString) {
    if (drop.size != null && drop.size > MAX_ENCRYPTED_PREVIEW_SIZE) {
      return {
        previewUrl: '',
        previewType: null,
        decryptedFileName: null,
        isBlobUrl: false,
        previewUnavailableReason: 'Preview disabled for large encrypted files. Download to view.',
      };
    }

    const res = await fetch(getFileUrl(id));
    if (!res.ok) throw new Error(`Preview fetch failed (${res.status})`);
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
        previewUnavailableReason: null,
      };
    }

    return {
      previewUrl: '',
      previewType: null,
      decryptedFileName: fileName,
      isBlobUrl: false,
      previewUnavailableReason: null,
    };
  }

  return null;
}

export function useFilePreview(drop: DropJson | null, id: string, keyString: string) {
  const isFileDrop = drop?.type === 'file';

  const { data, isLoading } = useQuery({
    queryKey: ['drop', id, 'preview', keyString],
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
    previewUnavailableReason: data?.previewUnavailableReason ?? null,
  };
}
