import { useState, useRef, type DragEvent } from 'react';
import { createDrop, TTL_OPTIONS, formatSize, isUrl } from '@/lib/api';
import {
  generateKey,
  exportKey,
  encryptText,
  encrypt,
  arrayBufferToBase64,
  packFile,
} from '@/lib/crypto';
import { CodeEditor, languages } from '@/components/code-editor';
import type { DropJson } from '@dropthing/shared';

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
  const [result, setResult] = useState<DropJson | null>(null);
  const [copied, setCopied] = useState(false);
  const [encrypted, setEncrypted] = useState(false);
  const [keyFragment, setKeyFragment] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shareUrl = result
    ? `${window.location.origin}/drops/${result.id}${keyFragment ? `#${keyFragment}` : ''}`
    : '';
  const contentIsUrl = mode === 'text' && isUrl(content);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
      const type = contentIsUrl ? 'link' : mode;
      const shouldEncrypt = encrypted && !contentIsUrl;

      let uploadFile = mode === 'file' ? (file ?? undefined) : undefined;
      let uploadContent = mode === 'text' ? content : undefined;
      let fragment = '';

      if (shouldEncrypt) {
        const key = await generateKey();
        fragment = await exportKey(key);

        if (mode === 'file' && file) {
          const packed = packFile(file.name, await file.arrayBuffer());
          const ciphertext = await encrypt(key, packed);
          uploadFile = new File([ciphertext], 'encrypted.bin', {
            type: 'application/octet-stream',
          });
        } else if (mode === 'text') {
          const ciphertext = await encryptText(key, content);
          uploadContent = arrayBufferToBase64(ciphertext);
        }
      }

      const drop = await createDrop({
        type,
        expiresIn: ttl,
        file: uploadFile,
        content: uploadContent,
        encrypted: shouldEncrypt,
      });
      setKeyFragment(fragment);
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
    setEncrypted(false);
    setKeyFragment('');
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
              {result.metadata?.title ??
                (result.type === 'file' ? result.fileName : result.type + ' drop')}
            </p>
          </div>

          <div className="space-y-3">
            {keyFragment && (
              <p className="text-amber-400/80 text-xs text-center">
                Encrypted — the decryption key is embedded in the link
              </p>
            )}
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
              className={`w-9 h-5 rounded-full relative transition-colors ${encrypted ? 'bg-green-600' : 'bg-neutral-700'}`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${encrypted ? 'translate-x-4' : ''}`}
              />
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
