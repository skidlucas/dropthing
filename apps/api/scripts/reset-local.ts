import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const target = resolve(import.meta.dir, '../.wrangler/state');
if (!target.includes('/apps/api/.wrangler/state'))
  throw new Error('Refusing unsafe local reset target');
await rm(target, { recursive: true, force: true });
console.log('Removed only apps/api/.wrangler/state; rerun db:migrate:local.');
