import { Effect } from 'effect';
import type { Context as HonoContext } from 'hono';

// oxlint-disable-next-line typescript/no-explicit-any -- accepts any error type, catchAll handles everything
export const withBasicErrorHandling = <A, R>(c: HonoContext, effect: Effect.Effect<A, any, R>) =>
  effect.pipe(
    Effect.catchTag('InvalidInputError', () =>
      Effect.succeed(c.json({ error: 'Invalid input' }, 400))
    ),
    Effect.catchTag('ParseError', () => Effect.succeed(c.json({ error: 'Parse error' }, 500))),
    Effect.catchAll(() => Effect.succeed(c.json({ error: 'Internal server error' }, 500)))
  );
