import { Effect } from 'effect';
import type { Context as HonoContext } from 'hono';

// oxlint-disable-next-line typescript/no-explicit-any -- accepts any error type, catch handles everything
export const withBasicErrorHandling = <A, R>(c: HonoContext, effect: Effect.Effect<A, any, R>) =>
  effect.pipe(
    Effect.catchTags({
      InvalidInputError: (e) => Effect.succeed(c.json({ error: e.message }, 400)),
      FileTooLargeError: (e) => Effect.succeed(c.json({ error: e.message }, 413)),
      SchemaError: (e) => Effect.succeed(c.json({ error: e.message }, 500)),
      DatabaseError: (e) => Effect.succeed(c.json({ error: e.message }, 500)),
      StorageError: (e) => Effect.succeed(c.json({ error: e.message }, 500)),
    }),
    Effect.catch(() => Effect.succeed(c.json({ error: 'Internal server error' }, 500)))
  );
