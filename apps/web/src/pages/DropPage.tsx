import { useEffect, useState } from 'react';
import type { DropJson } from '@dropthing/shared';
import { getDrop, getFileUrl, formatSize, timeRemaining } from '@/lib/api';
import { importKey, decrypt, decryptText, base64ToArrayBuffer, unpackFile } from '@/lib/crypto';
import { CodeEditor } from '@/components/code-editor';

export function DropPage({ id }: { id: string }) {
  const [drop, setDrop] = useState<DropJson | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const keyString = window.location.hash.slice(1);

  useEffect(() => {
    getDrop(id)
      .then(async (d) => {
        setDrop(d);
        if (d.encrypted && d.type === 'text' && d.content) {
          if (!keyString) {
            setError('This drop is encrypted. The decryption key is missing from the URL.');
            return;
          }
          setDecrypting(true);
          try {
            const key = await importKey(keyString);
            const ciphertext = base64ToArrayBuffer(d.content);
            const plaintext = await decryptText(key, ciphertext);
            setDecryptedContent(plaintext);
          } catch {
            setError('Decryption failed — invalid key');
          } finally {
            setDecrypting(false);
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [id, keyString]);

  async function handleEncryptedDownload() {
    if (!drop || !keyString) return;
    setDownloading(true);
    try {
      const res = await fetch(getFileUrl(id));
      const ciphertext = await res.arrayBuffer();
      const key = await importKey(keyString);
      const decrypted = await decrypt(key, ciphertext);
      const { fileName, content } = unpackFile(decrypted);
      const blob = new Blob([content.buffer as ArrayBuffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to decrypt file');
    } finally {
      setDownloading(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-4">
      <div className={`w-full space-y-8 ${drop?.type === 'text' ? 'max-w-2xl' : 'max-w-md'}`}>
        <header className="text-center">
          <h1>
            <a
              href="/"
              className="text-3xl font-bold tracking-tight hover:opacity-80 transition-opacity"
            >
              dropthing
            </a>
          </h1>
        </header>

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
              <h2 className="text-neutral-200 font-medium text-lg">
                {drop.metadata?.title ?? drop.fileName}
              </h2>
              {drop.metadata?.title && <p className="text-neutral-500 text-sm">{drop.fileName}</p>}
              <div className="flex items-center justify-center gap-3 text-neutral-500 text-sm">
                {drop.size && <span>{formatSize(drop.size)}</span>}
                {drop.encrypted && <span className="text-amber-400/80">Encrypted</span>}
                <span>expires in {timeRemaining(drop.expiresAt)}</span>
              </div>
            </div>

            {drop.encrypted && !keyString ? (
              <p className="text-red-400 text-sm text-center">
                Decryption key is missing from the URL
              </p>
            ) : drop.encrypted ? (
              <button
                type="button"
                onClick={handleEncryptedDownload}
                disabled={downloading}
                className="w-full py-2.5 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40"
              >
                {downloading ? 'Decrypting...' : 'Decrypt & Download'}
              </button>
            ) : (
              <a
                href={getFileUrl(id)}
                download
                className="block w-full py-2.5 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 transition-colors text-center"
              >
                Download
              </a>
            )}
          </div>
        )}

        {drop && drop.type === 'text' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              {drop.metadata?.title && (
                <h2 className="text-neutral-200 font-medium text-lg">{drop.metadata.title}</h2>
              )}
              <div className="flex items-center justify-center gap-3 text-neutral-500 text-sm">
                {drop.encrypted && <span className="text-amber-400/80">Encrypted</span>}
                <span>{drop.metadata?.language ?? 'Text snippet'}</span>
                <span>expires in {timeRemaining(drop.expiresAt)}</span>
              </div>
            </div>

            {decrypting ? (
              <p className="text-center text-neutral-500">Decrypting...</p>
            ) : drop.encrypted && !keyString ? (
              <p className="text-red-400 text-sm text-center">
                Decryption key is missing from the URL
              </p>
            ) : (
              <>
                <CodeEditor
                  value={drop.encrypted ? (decryptedContent ?? '') : (drop.content ?? '')}
                  readOnly
                  maxHeight="600px"
                  {...(drop.metadata?.language != null ? { language: drop.metadata.language } : {})}
                />

                <button
                  type="button"
                  onClick={() =>
                    handleCopy(drop.encrypted ? (decryptedContent ?? '') : (drop.content ?? ''))
                  }
                  className="w-full py-2.5 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy content'}
                </button>
              </>
            )}
          </div>
        )}

        {drop && drop.type === 'link' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              {drop.metadata?.title && (
                <h2 className="text-neutral-200 font-medium text-lg">{drop.metadata.title}</h2>
              )}
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
    </main>
  );
}
