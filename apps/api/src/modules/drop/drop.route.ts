import { Hono } from 'hono';
import { Effect, Schema } from 'effect';
import type { ManagedRuntime } from 'effect';
import { DropService, type CreateDropInput } from './drop.service.js';
import { InvalidInputError, UUID, UploadParams } from '@dropthing/shared';
import { withBasicErrorHandling } from '../../common/helpers.js';

// oxlint-disable-next-line typescript/no-explicit-any -- layer error type is complex, using any for simplicity
type AppRuntime = ManagedRuntime.ManagedRuntime<DropService, any>;

const parseParams = Effect.fn('drops.parseParams')(function* (formData: FormData) {
  const obj: Record<string, unknown> = {
    type: formData.get('type'),
    expiresIn: formData.get('expiresIn'),
  };
  const encrypted = formData.get('encrypted');
  if (encrypted) obj.encrypted = encrypted;

  return yield* Schema.decodeUnknownEffect(UploadParams)(obj).pipe(
    Effect.mapError((e) => new InvalidInputError({ message: e.message }))
  );
});

export default function dropRoutes(runtime: AppRuntime) {
  const drops = new Hono();

  drops.post('/', async (c) => {
    const formData = await c.req.formData();

    const program = withBasicErrorHandling(
      c,
      Effect.gen(function* () {
        const params = yield* parseParams(formData);
        const dropService = yield* DropService;
        const encrypted = params.encrypted === 'true';

        let input: CreateDropInput;

        if (params.type === 'file') {
          const file = formData.get('file') as File | null;
          if (!file) return yield* new InvalidInputError({ message: 'Missing file' });
          input = { type: 'file', file, expiresIn: params.expiresIn, encrypted };
        } else {
          const content = formData.get('content') as string | null;
          if (!content) {
            return yield* new InvalidInputError({
              message: `Missing content for ${params.type} drop`,
            });
          }
          input = {
            type: params.type,
            content,
            expiresIn: params.expiresIn,
            encrypted,
          };
        }

        const drop = yield* dropService.create(input);
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

        return c.json(drop);
      })
    );

    return runtime.runPromise(program);
  });

  drops.get('/:id/file', async (c) => {
    const program = withBasicErrorHandling(
      c,
      Effect.gen(function* () {
        const id = yield* Schema.decodeUnknownEffect(UUID)(c.req.param('id')).pipe(
          Effect.mapError((e) => new InvalidInputError({ message: e.message }))
        );

        const dropService = yield* DropService;
        const { drop, content } = yield* dropService.getFile(id);

        return new Response(Buffer.from(content), {
          status: 200,
          headers: {
            'Content-Type': drop.mimeType ?? 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${drop.fileName}"`,
            'Content-Length': content.length.toString(),
          },
        });
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
        yield* dropService.delete(id);

        return c.json({ message: 'Drop deleted' }, 200);
      })
    );

    return runtime.runPromise(program);
  });

  return drops;
}
