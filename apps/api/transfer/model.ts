export interface TransferDrop {
  id: string;
  type: 'file' | 'text' | 'link';
  content: string | null;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  storageKey: string | null;
  metadata: { language?: string; title?: string } | null;
  encrypted: boolean;
  createdAt: string;
  expiresAt: string;
}
export interface TransferEnvelope {
  version: 1;
  extractedAt: string;
  source: 'postgres';
  rows: TransferDrop[];
}

export const fingerprint = async (rows: readonly TransferDrop[]): Promise<string> => {
  const stable = [...rows]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((row) => JSON.stringify(row))
    .join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
