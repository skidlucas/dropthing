import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DropJson } from '@dropthing/shared';
import { getFileUrl } from '@/lib/api';
import { importKey, decryptFileStream, readEncryptedFileHeader } from '@/lib/crypto';
import { getPreviewType, mimeFromExtension, type PreviewType } from '@/lib/preview';

const MAX_ENCRYPTED_PREVIEW_SIZE = 100 * 1024 * 1024;

interface FilePreviewData {
  previewUrl: string;
  previewType: PreviewType | null;
  decryptedFileName: string | null;
  isBlobUrl: boolean;
  previewUnavailableReason: string | null;
}

async function fetchFileBody(url: string): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Preview fetch failed (${res.status})`);
  if (res.body) return res.body;
  return (await res.blob()).stream();
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

  // Encrypted: read and authenticate only the header first so large files don't get
  // decrypted just to discover their filename/previewability.
  if (drop.encrypted && keyString) {
    const key = await importKey(keyString);
    const header = await readEncryptedFileHeader(key, await fetchFileBody(getFileUrl(id)));
    const mime = mimeFromExtension(header.fileName);
    const type = mime ? getPreviewType(mime) : null;

    if (!type || !mime || header.originalSize > MAX_ENCRYPTED_PREVIEW_SIZE) {
      return {
        previewUrl: '',
        previewType: null,
        decryptedFileName: header.fileName,
        isBlobUrl: false,
        previewUnavailableReason:
          header.originalSize > MAX_ENCRYPTED_PREVIEW_SIZE
            ? 'Preview disabled for large encrypted files. Download to view.'
            : null,
      };
    }

    const decrypted = await decryptFileStream(key, await fetchFileBody(getFileUrl(id)));
    const contentBlob = await new Response(decrypted.stream).blob();
    const blob = contentBlob.slice(0, contentBlob.size, mime);
    return {
      previewUrl: URL.createObjectURL(blob),
      previewType: type,
      decryptedFileName: decrypted.fileName,
      isBlobUrl: true,
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
