import { Hono } from 'hono';
import { Effect, Schema } from 'effect';
import type { ManagedRuntime } from 'effect';
import { DropService } from '../services/drop.js';
import { InvalidInputError, UUID } from '@dropthing/shared';
import { withBasicErrorHandling } from '../helpers.js';

// oxlint-disable-next-line typescript/no-explicit-any -- layer error type is complex, using any for simplicity
type AppRuntime = ManagedRuntime.ManagedRuntime<DropService, any>;

export default function dropRoutes(runtime: AppRuntime) {
  const drops = new Hono();

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

  // TODO: POST / — upload
  // TODO: GET /:id/file — download

  return drops;
}
