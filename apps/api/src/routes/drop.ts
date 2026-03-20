import path from 'node:path';
import { Hono } from 'hono';
import { Effect, Schema } from 'effect';
import type { ManagedRuntime } from 'effect';
import { DropService } from '../services/drop.js';
import {
  FileTooLargeError,
  InvalidInputError,
  MAX_FILE_SIZE,
  UUID,
  UploadParams,
} from '@dropthing/shared';
import { withBasicErrorHandling } from '../helpers.js';

// oxlint-disable-next-line typescript/no-explicit-any -- layer error type is complex, using any for simplicity
type AppRuntime = ManagedRuntime.ManagedRuntime<DropService, any>;

// TODO: Replace with StorageService in Phase 3
const UPLOADS_DIR = './uploads';

export default function dropRoutes(runtime: AppRuntime) {
  const drops = new Hono();

  drops.post('/', async (c) => {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const expiresIn = formData.get('expiresIn') as string | null;

    const program = withBasicErrorHandling(
      c,
      Effect.gen(function* () {
        if (!file) {
          return yield* new InvalidInputError({ message: 'Missing file' });
        }

        if (file.size > MAX_FILE_SIZE) {
          return yield* new FileTooLargeError({
            message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
            maxSize: MAX_FILE_SIZE,
            actualSize: file.size,
          });
        }

        const params = yield* Schema.decodeUnknownEffect(UploadParams)({
          expiresIn,
        }).pipe(Effect.mapError((e) => new InvalidInputError({ message: e.message })));

        const storageKey = `${crypto.randomUUID()}${path.extname(file.name)}`;

        // Save file to local disk (will be replaced by StorageService in Phase 3)
        yield* Effect.tryPromise({
          try: () => Bun.write(`${UPLOADS_DIR}/${storageKey}`, file),
          catch: () => new InvalidInputError({ message: 'Failed to save file' }),
        });

        const dropService = yield* DropService;
        const drop = yield* dropService.create({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          storageKey,
          expiresIn: params.expiresIn,
        });

        return c.json(drop, 201);
      })
    );

    return runtime.runPromise(program);
  });

  drops.get('/:id', async (c) => {
    const program = withBasicErrorHandling(
      c,
      Effect.gen(function* () {
        const id = yield* Schema.decodeUnknownEffect(UUID)(c.req.param('id')).pipe(
          Effect.mapError((e) => new InvalidInputError({ message: e.message }))
        );

        const dropService = yield* DropService;
        const drop = yield* dropService.get(id);
        if (!drop) return c.json({ error: 'Drop not found' }, 404);

        return c.json(drop);
      })
    );

    return runtime.runPromise(program);
  });

  drops.delete('/:id', async (c) => {
    const program = withBasicErrorHandling(
      c,
      Effect.gen(function* () {
        const id = yield* Schema.decodeUnknownEffect(UUID)(c.req.param('id')).pipe(
          Effect.mapError((e) => new InvalidInputError({ message: e.message }))
        );

        const dropService = yield* DropService;
        const drop = yield* dropService.get(id);
        if (!drop) return c.json({ error: 'Drop not found' }, 404);

        yield* dropService.delete(id);

        return c.json({ message: 'Drop deleted' }, 200);
      })
    );

    return runtime.runPromise(program);
  });

  // TODO: GET /:id/file — download

  return drops;
}
