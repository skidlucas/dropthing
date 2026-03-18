import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Layer, ManagedRuntime } from 'effect';
import { DropServiceLive } from './services/drop.js';
import { DrizzleLive, PgClientLive } from './services/db.js';
import health from './routes/health.js';
import dropRoutes from './routes/drop.js';

// Compose all layers at the entry point:
// PgClientLive → DrizzleLive → DropServiceLive
const AppLayer = DropServiceLive.pipe(Layer.provide(DrizzleLive), Layer.provide(PgClientLive));
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
