import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Layer, ManagedRuntime } from 'effect';
import { DropService } from './services/drop.js';
import { DrizzleService } from './services/db.js';
import health from './routes/health.js';
import dropRoutes from './routes/drop.js';

// Compose all layers at the entry point:
// DrizzleService.layer → DropService.layer
const AppLayer = DropService.layer.pipe(Layer.provide(DrizzleService.layer));
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
