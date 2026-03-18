import { Context, Effect, Layer, Schema } from 'effect';
import { eq, lt } from 'drizzle-orm';
import type { DrizzleQueryError } from 'drizzle-orm/errors';
import { Drop } from '@dropthing/shared';
import { dropsTable } from '../db/schema.js';
import { DrizzleService } from './db.js';
import { ParseError } from 'effect/ParseResult';

const decodeDrop = Schema.decodeUnknown(Drop);
const decodeDrops = Schema.decodeUnknown(Schema.Array(Drop));

export class DropService extends Context.Tag('DropService')<
  DropService,
  {
    readonly save: (drop: Drop) => Effect.Effect<void, DrizzleQueryError>;
    readonly get: (id: string) => Effect.Effect<Drop | null, ParseError | DrizzleQueryError>;
    readonly listExpired: () => Effect.Effect<ReadonlyArray<Drop>, ParseError | DrizzleQueryError>;
    readonly delete: (id: string) => Effect.Effect<void, DrizzleQueryError>;
  }
>() {}

export const DropServiceLive = Layer.effect(
  DropService,
  Effect.gen(function* () {
    const db = yield* DrizzleService;

    return {
      // todo : à tester
      save: (drop) => db.insert(dropsTable).values(drop),

      get: (id) =>
        Effect.gen(function* () {
          const rows = yield* db.select().from(dropsTable).where(eq(dropsTable.id, id));
          return rows[0] ? yield* decodeDrop(rows[0]) : null;
        }),

      // todo : à tester
      listExpired: () =>
        Effect.gen(function* () {
          const rows = yield* db
            .select()
            .from(dropsTable)
            .where(lt(dropsTable.expiresAt, new Date()));
          return yield* decodeDrops(rows);
        }),

      // todo : à tester
      delete: (id) => db.delete(dropsTable).where(eq(dropsTable.id, id)),
    };
  })
);
