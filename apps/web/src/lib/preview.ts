import mime from 'mime';

export type PreviewType = 'image' | 'video' | 'audio';

/** Returns the preview type if the MIME type is previewable, null otherwise */
export function getPreviewType(mimeType: string): PreviewType | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return null;
}

/** Infer MIME type from filename extension (used for encrypted files where server only sees application/octet-stream) */
export function mimeFromExtension(fileName: string): string | null {
  return mime.getType(fileName);
}
