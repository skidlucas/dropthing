import { Effect, Layer, Schema, ServiceMap } from 'effect';
import { eq, lt } from 'drizzle-orm';
import { Drop } from '@dropthing/shared';
import { dropsTable } from '../db/schema.js';
import { DatabaseError, DrizzleService, query } from './db.js';

const decodeDrop = Schema.decodeUnknownEffect(Drop);
const decodeDrops = Schema.decodeUnknownEffect(Schema.Array(Drop));

type DropServiceShape = {
  readonly save: (drop: Drop) => Effect.Effect<void, DatabaseError>;
  readonly get: (id: string) => Effect.Effect<Drop | null, DatabaseError | Schema.SchemaError>;
  readonly listExpired: () => Effect.Effect<
    ReadonlyArray<Drop>,
    DatabaseError | Schema.SchemaError
  >;
  readonly delete: (id: string) => Effect.Effect<void, DatabaseError>;
};

export class DropService extends ServiceMap.Service<DropService, DropServiceShape>()(
  '@dropthing/DropService'
) {
  static readonly layer = Layer.effect(
    DropService,
    Effect.gen(function* () {
      const db = yield* DrizzleService;

      const save = Effect.fn('DropService.save')(function* (drop: Drop) {
        yield* query(db.insert(dropsTable).values(drop));
      });

      const get = Effect.fn('DropService.get')(function* (id: string) {
        const rows = yield* query(db.select().from(dropsTable).where(eq(dropsTable.id, id)));
        return rows[0] ? yield* decodeDrop(rows[0]) : null;
      });

      const listExpired = Effect.fn('DropService.listExpired')(function* () {
        const rows = yield* query(
          db.select().from(dropsTable).where(lt(dropsTable.expiresAt, new Date()))
        );
        return yield* decodeDrops(rows);
      });

      const del = Effect.fn('DropService.delete')(function* (id: string) {
        yield* query(db.delete(dropsTable).where(eq(dropsTable.id, id)));
      });

      return { save, get, listExpired, delete: del };
    })
  );
}
