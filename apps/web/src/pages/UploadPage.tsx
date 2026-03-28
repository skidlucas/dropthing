import { useState, useRef, type DragEvent } from 'react';
import { createDrop, TTL_OPTIONS, formatSize, isUrl, type Drop } from '@/lib/api';
import { CodeEditor, languages } from '@/components/code-editor';

type UploadMode = 'file' | 'text';

export function UploadPage() {
  const [mode, setMode] = useState<UploadMode>('text');
  const [ttl, setTtl] = useState(3600);
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Drop | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shareUrl = result ? `${window.location.origin}/drops/${result.id}` : '';
  const contentIsUrl = mode === 'text' && isUrl(content);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
      const type = contentIsUrl ? 'link' : mode;
      const drop = await createDrop({
        type,
        expiresIn: ttl,
        file: mode === 'file' ? (file ?? undefined) : undefined,
        content: mode === 'text' ? content : undefined,
      });
      setResult(drop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
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

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    setResult(null);
    setFile(null);
    setContent('');
    setLanguage('');
    setError(null);
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
              {result.type === 'file' ? result.fileName : result.type} drop
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-neutral-800 rounded-lg p-3 font-mono text-sm text-neutral-300 break-all">
              {shareUrl}
            </div>
            <button
              type="button"
              onClick={handleCopy}
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
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
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
              <div className="space-y-1">
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
                className="bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-neutral-400 text-xs focus:outline-none focus:border-neutral-500"
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
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
          >
            {TTL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

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
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-1">
          <a
            href="/"
            className="text-3xl font-bold tracking-tight hover:opacity-80 transition-opacity"
          >
            dropthing
          </a>
          <p className="text-neutral-500 text-sm">drop and share your stuff</p>
        </div>
        {children}
      </div>
    </div>
  );
}
