import { useEffect, useState } from 'react';
import { getDrop, getFileUrl, formatSize, timeRemaining, type Drop } from '@/lib/api';
import { CodeEditor } from '@/components/code-editor';

export function DropPage({ id }: { id: string }) {
  const [drop, setDrop] = useState<Drop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getDrop(id)
      .then(setDrop)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [id]);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-4">
      <div className={`w-full space-y-8 ${drop?.type === 'text' ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="text-center">
          <a
            href="/"
            className="text-3xl font-bold tracking-tight hover:opacity-80 transition-opacity"
          >
            dropthing
          </a>
        </div>

        {!drop && !error && <p className="text-center text-neutral-500">Loading...</p>}

        {error && (
          <div className="text-center space-y-4">
            <p className="text-red-400">{error}</p>
            <a
              href="/"
              className="inline-block text-neutral-400 hover:text-neutral-200 text-sm transition-colors"
            >
              Back to home
            </a>
          </div>
        )}

        {drop && drop.type === 'file' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-neutral-200 font-medium text-lg">{drop.fileName}</p>
              <div className="flex items-center justify-center gap-3 text-neutral-500 text-sm">
                {drop.size && <span>{formatSize(drop.size)}</span>}
                <span>expires in {timeRemaining(drop.expiresAt)}</span>
              </div>
            </div>

            <a
              href={getFileUrl(id)}
              download
              className="block w-full py-2.5 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 transition-colors text-center"
            >
              Download
            </a>
          </div>
        )}

        {drop && drop.type === 'text' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 text-neutral-500 text-sm">
                <span>Text snippet</span>
                <span>expires in {timeRemaining(drop.expiresAt)}</span>
              </div>
            </div>

            <CodeEditor value={drop.content ?? ''} readOnly maxHeight="600px" />

            <button
              type="button"
              onClick={() => handleCopy(drop.content ?? '')}
              className="w-full py-2.5 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy content'}
            </button>
          </div>
        )}

        {drop && drop.type === 'link' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 text-neutral-500 text-sm">
                <span>Shared link</span>
                <span>expires in {timeRemaining(drop.expiresAt)}</span>
              </div>
            </div>

            <a
              href={drop.content ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-blue-400 hover:text-blue-300 text-sm break-all transition-colors"
            >
              {drop.content}
            </a>

            <div className="flex gap-3">
              <a
                href={drop.content ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 transition-colors text-center"
              >
                Open link
              </a>
              <button
                type="button"
                onClick={() => handleCopy(drop.content ?? '')}
                className="flex-1 py-2.5 border border-neutral-700 text-neutral-200 rounded-lg font-medium hover:bg-neutral-800 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
