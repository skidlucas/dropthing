export function NotFoundPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <header>
          <h1>
            <a
              href="/"
              className="text-3xl font-bold tracking-tight hover:opacity-80 transition-opacity"
            >
              dropthing
            </a>
          </h1>
        </header>

        <div className="space-y-4">
          <p className="text-neutral-400 text-lg">Page not found</p>
          <a
            href="/"
            className="inline-block py-2.5 px-6 bg-neutral-50 text-neutral-950 rounded-lg font-medium hover:bg-neutral-200 transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
