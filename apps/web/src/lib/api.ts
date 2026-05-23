import type { DropJson } from '@dropthing/shared';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export async function createDrop(data: {
  type: 'text' | 'link';
  expiresIn: number;
  content: string;
  encrypted?: boolean;
}): Promise<DropJson> {
  const formData = new FormData();
  formData.append('type', data.type);
  formData.append('expiresIn', String(data.expiresIn));
  if (data.encrypted) formData.append('encrypted', 'true');
  formData.append('content', data.content);

  const res = await fetch(`${API_URL}/drops`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Upload failed');
  }

  return res.json();
}

export async function presignUpload(data: {
  fileName: string;
  mimeType: string;
  size: number;
  encrypted?: boolean;
}): Promise<{ uploadUrl: string; storageKey: string }> {
  const res = await fetch(`${API_URL}/drops/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to get upload URL');
  }

  return res.json();
}

export function uploadToPresigned(
  uploadUrl: string,
  file: File | Blob,
  contentType: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));

    xhr.send(file);
  });
}

export async function confirmUpload(data: {
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  expiresIn: number;
  encrypted?: boolean;
}): Promise<DropJson> {
  const res = await fetch(`${API_URL}/drops/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to confirm upload');
  }

  return res.json();
}

export async function getDrop(id: string): Promise<DropJson> {
  const res = await fetch(`${API_URL}/drops/${id}`);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Drop not found');
  }

  return res.json();
}

export function getFileUrl(id: string): string {
  return `${API_URL}/drops/${id}/file`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function isUrl(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.includes('\n')) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const TTL_OPTIONS = [
  { label: '5 minutes', value: 300 },
  { label: '1 hour', value: 3600 },
  { label: '1 day', value: 86400 },
  { label: '7 days', value: 604800 },
] as const;
