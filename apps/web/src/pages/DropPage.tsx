import { useState } from 'react';
import { getFileUrl, formatSize, timeRemaining } from '@/lib/api';
import { importKey, decrypt, unpackFile } from '@/lib/crypto';
import { useDrop } from '@/hooks/useDrop';
import { useFilePreview } from '@/hooks/useFilePreview';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { CodeEditor } from '@/components/code-editor';

export function DropPage({ id }: { id: string }) {
  const keyString = window.location.hash.slice(1);
  const { drop, decryptedContent, isLoading, error } = useDrop(id, keyString);
  const {
    previewUrl,
    previewType,
    isLoading: previewLoading,
    decryptedFileName,
  } = useFilePreview(drop, id, keyString);
  const { copied, copy } = useCopyFeedback();
  const [downloading, setDownloading] = useState(false);

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
      // Download error — user can retry
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-4">
      <div
        className={`w-full space-y-8 ${drop?.type === 'text' || previewType === 'image' || previewType === 'video' ? 'max-w-2xl' : 'max-w-md'}`}
      >
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

        {isLoading && (
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-neutral-500 animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}

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
                {drop.metadata?.title ?? decryptedFileName ?? drop.fileName}
              </h2>
              {drop.metadata?.title && (
                <p className="text-neutral-500 text-sm">{decryptedFileName ?? drop.fileName}</p>
              )}
              <div className="flex items-center justify-center gap-3 text-neutral-500 text-sm">
                {drop.size && <span>{formatSize(drop.size)}</span>}
                {drop.encrypted && <span className="text-amber-400/80">Encrypted</span>}
                <span>expires in {timeRemaining(drop.expiresAt)}</span>
              </div>
            </div>

            {previewLoading && (
              <div className="flex justify-center gap-1.5 py-8">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-neutral-500 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            )}

            {previewUrl && previewType === 'image' && (
              <img
                src={previewUrl}
                alt={drop.fileName ?? 'Preview'}
                className="w-full rounded-lg border border-neutral-800"
              />
            )}

            {previewUrl && previewType === 'video' && (
              <video
                src={previewUrl}
                controls
                className="w-full rounded-lg border border-neutral-800"
              >
                <track kind="captions" />
              </video>
            )}

            {previewUrl && previewType === 'audio' && (
              <audio src={previewUrl} controls className="w-full">
                <track kind="captions" />
              </audio>
            )}

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

            {drop.encrypted && !keyString ? (
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
                    copy(drop.encrypted ? (decryptedContent ?? '') : (drop.content ?? ''))
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
                onClick={() => copy(drop.content ?? '')}
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
