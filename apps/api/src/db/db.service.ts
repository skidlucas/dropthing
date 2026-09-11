import { Context, Effect, Layer, Schema } from 'effect';
import { drizzle } from 'drizzle-orm/d1';

export class DatabaseError extends Schema.TaggedError<DatabaseError>()('DatabaseError', {
  operation: Schema.String,
  error: Schema.Defect(),
}) {}

export type D1Db = ReturnType<typeof drizzle>;

export class DrizzleService extends Context.Service<DrizzleService, D1Db>()(
  '@dropthing/DrizzleService'
) {
  static layer(database: D1Database): Layer.Layer<DrizzleService> {
    return Layer.succeed(DrizzleService, drizzle(database));
  }
}

export const d1Effect = <A>(
  operation: string,
  run: () => Promise<A>
): Effect.Effect<A, DatabaseError> =>
  Effect.tryPromise({ try: run, catch: (error) => new DatabaseError({ operation, error }) });
