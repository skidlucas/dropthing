import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Layer, ManagedRuntime } from 'effect';
import { DropService } from './modules/drop/drop.service.js';
import { DropRepository } from './modules/drop/drop.repository.js';
import { DrizzleService } from './db/db.service.js';
import { LocalStorageLayer } from './modules/storage/localStorage.layer.js';
import health from './modules/health/health.route.js';
import dropRoutes from './modules/drop/drop.route.js';

// Compose all layers at the entry point:
// DrizzleService → DropRepository ─┐
// LocalStorageLayer ───────────────┼→ DropService
const AppLayer = DropService.layer.pipe(
  Layer.provide(DropRepository.layer),
  Layer.provide(DrizzleService.layer),
  Layer.provide(LocalStorageLayer)
);
const runtime = ManagedRuntime.make(AppLayer);

const app = new Hono();

app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  })
);

app.route('/health', health);
app.route('/drops', dropRoutes(runtime));

export default {
  port: 3001,
  fetch: app.fetch,
};
