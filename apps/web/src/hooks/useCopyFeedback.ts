import { useCallback } from 'react';
import { toast } from 'sonner';

export function useCopyFeedback() {
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }, []);

  return { copy };
}
