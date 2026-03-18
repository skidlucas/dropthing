import { PgClient } from '@effect/sql-pg';
import { drizzle } from 'drizzle-orm/effect-postgres';
import { Context, Layer, Effect, Redacted } from 'effect';
import { types } from 'pg';
import * as schema from '../db/schema.js';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export class DrizzleService extends Context.Tag('DrizzleService')<DrizzleService, DrizzleDb>() {}

export const PgClientLive = PgClient.layer({
  url: Redacted.make(process.env.DB_URL!),
  // Override the `pg` driver's default type parsers for date/time types.
  // By default, `pg` parses these PG types into JS Date objects before Drizzle
  // sees them. But Drizzle has its own parsing logic that expects raw strings.
  // Returning `val` as-is lets Drizzle handle the conversion itself,
  // avoiding double-parsing and inconsistent results.
  // OIDs: 1082=date, 1114=timestamp, 1184=timestamptz, 1186=interval,
  // 1115=timestamp[], 1185=timestamptz[], 1182=date[], 1187=interval[], 1231=numeric[]
  types: {
    getTypeParser: (typeId, format) => {
      if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
        return (val: unknown) => val;
      }
      return types.getTypeParser(typeId, format);
    },
  },
});

export const DrizzleLive = Layer.effect(
  DrizzleService,
  Effect.gen(function* () {
    const client = yield* PgClient.PgClient;
    return drizzle(client, { schema });
  })
);
