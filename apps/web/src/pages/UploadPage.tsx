import { useState, useRef, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TTL_OPTIONS, formatSize, isUrl } from '@/lib/api';
import { MAX_FILE_SIZE } from '@dropthing/shared';
import { useUploadDrop } from '@/hooks/useUploadDrop';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { CodeEditor } from '@/components/code-editor';

type UploadMode = 'file' | 'text';

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export function UploadPage() {
  const [mode, setMode] = useState<UploadMode>('file');
  const [ttl, setTtl] = useState(3600);
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [encrypted, setEncrypted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, result, uploading, progress, error, reset } = useUploadDrop();
  const { copy } = useCopyFeedback();

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

  return (
    <Layout>
      <AnimatePresence mode="wait">
        {result ? (
          <motion.div key="success" {...fadeIn} className="space-y-6">
            <div className="text-center space-y-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center"
              >
                <svg
                  className="w-6 h-6 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <motion.path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  />
                </svg>
              </motion.div>
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
                className="w-full py-2.5 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 active:scale-[0.98] transition-all"
              >
                Copy link
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2.5 text-neutral-400 hover:text-neutral-200 transition-colors text-sm"
            >
              Drop another
            </button>
          </motion.div>
        ) : (
          <motion.form key="form" {...fadeIn} onSubmit={handleSubmit} className="space-y-6">
            {/* Mode selector — sliding pill */}
            <div className="relative flex gap-1 bg-neutral-800 rounded-lg p-1">
              <motion.div
                className="absolute inset-y-1 left-1 w-[calc(50%-2px)] rounded-md bg-neutral-50"
                initial={false}
                animate={{ x: mode === 'file' ? 0 : 'calc(100% + 4px)' }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              />
              {(['file', 'text'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`relative z-10 flex-1 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 ${
                    mode === m ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {m === 'file' ? 'File' : 'Text'}
                </button>
              ))}
            </div>

            {/* File drop zone */}
            {mode === 'file' && (
              <div>
                <button
                  type="button"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                    dragging
                      ? 'bg-neutral-800/80 scale-[1.01] ring-2 ring-neutral-400 ring-offset-2 ring-offset-neutral-950'
                      : 'border-2 border-dashed border-neutral-700 hover:border-neutral-500'
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
                      <p className="text-neutral-700 text-xs">max {formatSize(MAX_FILE_SIZE)}</p>
                    </div>
                  )}
                </button>
              </div>
            )}

            {mode === 'text' && (
              <div>
                <CodeEditor
                  value={content}
                  onChange={setContent}
                  language={language}
                  onLanguageChange={setLanguage}
                  placeholder="Paste your text, code, or a link..."
                />
                {contentIsUrl && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-blue-400 text-xs mt-2"
                  >
                    Link detected — will be shared as a clickable link
                  </motion.p>
                )}
              </div>
            )}

            {/* TTL selector — pills */}
            <div className="space-y-2">
              <span className="text-neutral-400 text-sm">Expires in</span>
              <div className="flex gap-2">
                {TTL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTtl(opt.value)}
                    className={`flex-1 py-2 text-sm rounded-lg transition-all ${
                      ttl === opt.value
                        ? 'bg-neutral-50 text-neutral-950 font-medium'
                        : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
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

            {/* Progress bar */}
            {uploading && mode === 'file' && (
              <div className="space-y-1.5">
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-neutral-50 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(progress * 100)}%` }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-neutral-500 text-xs text-center">
                  {progress >= 1 ? 'Saving...' : `${Math.round(progress * 100)}%`}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || uploading}
              className="w-full py-2.5 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Drop it'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
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
          <p className="text-neutral-400 text-sm">drop and share your stuff</p>
        </header>
        {children}
      </div>
    </main>
  );
}
