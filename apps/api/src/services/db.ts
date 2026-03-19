import { drizzle } from 'drizzle-orm/node-postgres';
import { Effect, Layer, Schema, ServiceMap } from 'effect';
import * as schema from '../db/schema.js';

// Use an opaque type to avoid exposing drizzle's internal types
// (which reference non-portable .bun/ paths)
type DrizzleDb = ReturnType<typeof drizzle>;

export class DrizzleService extends ServiceMap.Service<DrizzleService, DrizzleDb>()(
  '@dropthing/DrizzleService'
) {
  static readonly layer = Layer.sync(DrizzleService, () =>
    drizzle(process.env.DB_URL!, { schema })
  );
}

export class DatabaseError extends Schema.TaggedErrorClass('DatabaseError')('DatabaseError', {
  message: Schema.String,
  error: Schema.Defect,
}) {}

export const query = <A>(promise: Promise<A>): Effect.Effect<A, DatabaseError> =>
  Effect.tryPromise({
    try: () => promise,
    catch: (error) => new DatabaseError({ message: 'Database query failed', error }),
  });
