import { lazy, Suspense } from 'react';
import { UploadPage } from '@/pages/UploadPage';

const DropPage = lazy(() => import('@/pages/DropPage').then((m) => ({ default: m.DropPage })));

export function App() {
  const path = window.location.pathname;
  const dropMatch = path.match(/^\/drops\/([a-f0-9-]+)$/);

  if (dropMatch) {
    return (
      <Suspense>
        <DropPage id={dropMatch[1]} />
      </Suspense>
    );
  }

  if (path !== '/') {
    window.location.replace('/');
    return null;
  }

  return <UploadPage />;
}
