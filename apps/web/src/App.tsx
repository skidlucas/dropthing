import { UploadPage } from '@/pages/UploadPage';
import { DropPage } from '@/pages/DropPage';

export function App() {
  const path = window.location.pathname;
  const dropMatch = path.match(/^\/drops\/([a-f0-9-]+)$/);

  if (dropMatch) {
    return <DropPage id={dropMatch[1]} />;
  }

  return <UploadPage />;
}
