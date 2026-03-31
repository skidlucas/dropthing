import { useQuery } from '@tanstack/react-query';
import type { DropJson } from '@dropthing/shared';
import { getDrop } from '@/lib/api';
import { importKey, decryptText, base64ToArrayBuffer } from '@/lib/crypto';

interface DropData {
  drop: DropJson;
  decryptedContent: string | null;
}

async function fetchDrop(id: string, keyString: string): Promise<DropData> {
  const drop = await getDrop(id);
  let decryptedContent: string | null = null;

  if (drop.encrypted && drop.type === 'text' && drop.content) {
    if (!keyString) {
      throw new Error('This drop is encrypted. The decryption key is missing from the URL.');
    }
    const key = await importKey(keyString);
    const ciphertext = base64ToArrayBuffer(drop.content);
    decryptedContent = await decryptText(key, ciphertext);
  }

  return { drop, decryptedContent };
}

function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (msg.includes('missing from the URL') || msg.includes('Decryption failed')) return msg;
  if (msg.includes('not found')) return 'This drop doesn\u2019t exist or has been deleted.';
  if (msg.includes('expired')) return 'This drop has expired.';
  return 'Failed to load this drop. Please check the link and try again.';
}

export function useDrop(id: string, keyString: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['drop', id, keyString],
    queryFn: () => fetchDrop(id, keyString),
  });

  return {
    drop: data?.drop ?? null,
    decryptedContent: data?.decryptedContent ?? null,
    isLoading,
    error: error ? mapError(error) : null,
  };
}
