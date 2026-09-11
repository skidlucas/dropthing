import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { DrizzleService } from './db/db.service.js';
import { DropRepository } from './modules/drop/drop.repository.js';
import { DropService } from './modules/drop/drop.service.js';
import { AiService } from './modules/ai/ai.service.js';
import { CleanupService } from './modules/cleanup/cleanup.service.js';
import { makeR2StorageLayer, objectKey } from './modules/storage/r2Storage.layer.js';
import health from './modules/health/health.route.js';
import dropRoutes from './modules/drop/drop.route.js';

type Env = Cloudflare.Env;
const finalizeBody = (body: ReadableStream<Uint8Array>, finalize: () => Promise<void>) => {
  const reader = body.getReader();
  let finalized = false;
  const finish = async () => {
    if (!finalized) {
      finalized = true;
      await finalize();
    }
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          await finish();
        } else controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
        await finish();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
      await finish();
    },
  });
};

const makeRuntime = (env: Env, origin?: string) => {
  const databaseLayer = DrizzleService.layer(env.DB);
  const storageLayer = makeR2StorageLayer({
    bucket: env.FILES,
    bucketName: env.R2_BUCKET_NAME,
    prefix: env.R2_PREFIX,
    ...(env.R2_ACCOUNT_ID ? { accountId: env.R2_ACCOUNT_ID } : {}),
    ...(env.R2_ACCESS_KEY_ID ? { accessKeyId: env.R2_ACCESS_KEY_ID } : {}),
    ...(env.R2_SECRET_ACCESS_KEY ? { secretAccessKey: env.R2_SECRET_ACCESS_KEY } : {}),
    ...(env.ENVIRONMENT === 'local' && origin ? { localOrigin: origin } : {}),
  });
  return ManagedRuntime.make(
    Layer.mergeAll(DropService.layer, CleanupService.layer).pipe(
      Layer.provide(DropRepository.layer),
      Layer.provide(databaseLayer),
      Layer.provide(storageLayer),
      Layer.provide(AiService.layer(env.GROQ_API_KEY))
    )
  );
};

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const runtime = makeRuntime(env, url.origin);
    const app = new Hono();
    app.use(
      '/api/*',
      cors({
        origin: env.CORS_ORIGIN,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
      })
    );
    app.route('/api/health', health);
    app.route(
      '/api/drops',
      dropRoutes(runtime, env.ENVIRONMENT === 'local' ? undefined : env.R2_PUBLIC_URL)
    );
    app.put('/api/uploads/*', async (c) => {
      if (env.ENVIRONMENT !== 'local') return c.notFound();
      const key = decodeURIComponent(url.pathname.slice('/api/uploads/'.length));
      await env.FILES.put(objectKey(env.R2_PREFIX, key), c.req.raw.body, {
        httpMetadata: { contentType: c.req.header('content-type') ?? 'application/octet-stream' },
      });
      return c.body(null, 204);
    });
    const response = await app.fetch(request, env);
    if (url.pathname.endsWith('/file') && response.body) {
      return new Response(
        finalizeBody(response.body, () => runtime.dispose()),
        response
      );
    }
    await runtime.dispose();
    return response;
  },
  async scheduled(_controller, env, ctx) {
    const runtime = makeRuntime(env);
    ctx.waitUntil(
      runtime
        .runPromise(
          Effect.gen(function* () {
            const cleanup = yield* CleanupService;
            yield* cleanup.runOnce();
          })
        )
        .finally(() => runtime.dispose())
    );
  },
};
export default worker;
