import { useState, useRef, type DragEvent } from 'react';
import { TTL_OPTIONS, formatSize, isUrl } from '@/lib/api';
import { useUploadDrop } from '@/hooks/useUploadDrop';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { CodeEditor, languages } from '@/components/code-editor';

type UploadMode = 'file' | 'text';

export function UploadPage() {
  const [mode, setMode] = useState<UploadMode>('text');
  const [ttl, setTtl] = useState(3600);
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [encrypted, setEncrypted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, result, uploading, error, reset } = useUploadDrop();
  const { copied, copy } = useCopyFeedback();

  const contentIsUrl = mode === 'text' && isUrl(content);

  const shareUrl = result
    ? `${window.location.origin}/drops/${result.drop.id}${result.keyFragment ? `#${result.keyFragment}` : ''}`
    : '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    upload({ mode, ttl, file, content, encrypted, contentIsUrl });
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setMode('file');
    }
  }

  function handleReset() {
    reset();
    setFile(null);
    setContent('');
    setLanguage('');
    setEncrypted(false);
  }

  const isValid =
    (mode === 'file' && file !== null) || (mode === 'text' && content.trim().length > 0);

  if (result) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="text-green-400 text-lg font-medium">Uploaded</div>
            <p className="text-neutral-400 text-sm">
              {result.drop.metadata?.title ??
                (result.drop.type === 'file'
                  ? encrypted
                    ? file?.name
                    : result.drop.fileName
                  : result.drop.type + ' drop')}
            </p>
          </div>

          <div className="space-y-3">
            {result.keyFragment && (
              <p className="text-amber-400/80 text-xs text-center">
                Encrypted — the decryption key is embedded in the link
              </p>
            )}
            <div className="bg-neutral-800 rounded-lg p-3 font-mono text-sm text-neutral-300 break-all">
              {shareUrl}
            </div>
            <button
              type="button"
              onClick={() => copy(shareUrl)}
              className="w-full py-2.5 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="w-full py-2.5 text-neutral-400 hover:text-neutral-200 transition-colors text-sm"
          >
            Drop another
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mode selector */}
        <div className="flex gap-1 bg-neutral-800 rounded-lg p-1">
          {(['file', 'text'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                mode === m
                  ? 'bg-neutral-50 text-neutral-950'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {m === 'file' ? 'File' : 'Text'}
            </button>
          ))}
        </div>

        {/* File drop zone */}
        {mode === 'file' && (
          <button
            type="button"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-neutral-400 bg-neutral-800'
                : 'border-neutral-700 hover:border-neutral-500'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="space-y-1">
                <p className="text-neutral-200 font-medium">{file.name}</p>
                <p className="text-neutral-500 text-sm">{formatSize(file.size)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <svg
                  className="mx-auto w-8 h-8 text-neutral-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="text-neutral-400">Drop a file here</p>
                <p className="text-neutral-600 text-sm">or click to browse</p>
              </div>
            )}
          </button>
        )}

        {/* Code editor */}
        {mode === 'text' && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 text-sm focus-visible:border-neutral-500"
              >
                <option value="">Plain Text</option>
                {languages.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <CodeEditor
              value={content}
              onChange={setContent}
              language={language}
              placeholder="Paste your text, code, or a link..."
            />
            {contentIsUrl && (
              <p className="text-blue-400 text-xs">
                Link detected — will be shared as a clickable link
              </p>
            )}
          </div>
        )}

        {/* TTL selector */}
        <div className="flex items-center gap-3">
          <span className="text-neutral-500 text-sm shrink-0">Expires in</span>
          <select
            value={ttl}
            onChange={(e) => setTtl(Number(e.target.value))}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 text-sm focus-visible:border-neutral-500"
          >
            {TTL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Encryption toggle */}
        {!contentIsUrl && (
          <label className="flex items-center gap-3 min-h-[44px] cursor-pointer group">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={encrypted}
              onChange={(e) => setEncrypted(e.target.checked)}
              role="switch"
              aria-checked={encrypted}
            />
            <div
              className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${encrypted ? 'bg-green-600' : 'bg-neutral-700'}`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 flex items-center justify-center ${encrypted ? 'translate-x-5' : ''}`}
              >
                <svg
                  className="w-3 h-3 text-neutral-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  {encrypted ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                    />
                  )}
                </svg>
              </div>
            </div>
            <span className="text-neutral-400 text-sm group-hover:text-neutral-300 transition-colors">
              End-to-end encryption
            </span>
          </label>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        {/* Submit */}
        <button
          type="submit"
          disabled={!isValid || uploading}
          className="w-full py-2.5 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Drop it'}
        </button>
      </form>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center space-y-1">
          <h1>
            <a
              href="/"
              className="text-3xl font-bold tracking-tight hover:opacity-80 transition-opacity"
            >
              dropthing
            </a>
          </h1>
          <p className="text-neutral-500 text-sm">drop and share your stuff</p>
        </header>
        {children}
      </div>
    </main>
  );
}
