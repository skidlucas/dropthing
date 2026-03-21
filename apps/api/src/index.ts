import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Layer, ManagedRuntime } from 'effect';
import { DropService } from './modules/drop/drop.service.js';
import { DropRepository } from './modules/drop/drop.repository.js';
import { DrizzleService } from './db/db.service.js';
import health from './modules/health/health.route.js';
import dropRoutes from './modules/drop/drop.route.js';

// Compose all layers at the entry point:
// DrizzleService → DropRepository → DropService
const AppLayer = DropService.layer.pipe(
  Layer.provide(DropRepository.layer),
  Layer.provide(DrizzleService.layer)
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
