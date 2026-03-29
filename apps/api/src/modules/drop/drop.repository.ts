import { Effect, Layer, Schema, ServiceMap } from 'effect';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import type { DropType, DropMetadata } from '@dropthing/shared';
import { Drop } from '@dropthing/shared';
import { dropsTable } from '../../db/schema.js';
import { DatabaseError, DrizzleService, query } from '../../db/db.service.js';

const decodeDrop = Schema.decodeUnknownEffect(Drop);
const decodeDrops = Schema.decodeUnknownEffect(Schema.Array(Drop));

export interface InsertDropInput {
  readonly type: DropType;
  readonly expiresAt: Date;
  readonly content?: string | null;
  readonly fileName?: string | null;
  readonly mimeType?: string | null;
  readonly size?: number | null;
  readonly storageKey?: string | null;
  readonly metadata?: DropMetadata | null;
  readonly encrypted?: boolean;
}

type DropRepositoryShape = {
  readonly insert: (
    input: InsertDropInput
  ) => Effect.Effect<Drop, DatabaseError | Schema.SchemaError>;
  readonly findById: (id: string) => Effect.Effect<Drop | null, DatabaseError | Schema.SchemaError>;
  readonly findExpiredWithStorageKey: () => Effect.Effect<
    ReadonlyArray<Drop>,
    DatabaseError | Schema.SchemaError
  >;
  readonly deleteById: (id: string) => Effect.Effect<void, DatabaseError>;
  readonly clearStorageKey: (id: string) => Effect.Effect<void, DatabaseError>;
};

export class DropRepository extends ServiceMap.Service<DropRepository, DropRepositoryShape>()(
  '@dropthing/DropRepository'
) {
  static readonly layer = Layer.effect(
    DropRepository,
    Effect.gen(function* () {
      const db = yield* DrizzleService;

      const insert = Effect.fn('DropRepository.insert')(function* (input: InsertDropInput) {
        const row = {
          id: crypto.randomUUID(),
          type: input.type,
          content: input.content ?? null,
          fileName: input.fileName ?? null,
          mimeType: input.mimeType ?? null,
          size: input.size ?? null,
          storageKey: input.storageKey ?? null,
          metadata: input.metadata ?? null,
          encrypted: input.encrypted ?? false,
          createdAt: new Date(),
          expiresAt: input.expiresAt,
        };

        yield* query(db.insert(dropsTable).values(row));

        return yield* decodeDrop(row);
      });

      const findById = Effect.fn('DropRepository.findById')(function* (id: string) {
        const rows = yield* query(db.select().from(dropsTable).where(eq(dropsTable.id, id)));
        return rows[0] ? yield* decodeDrop(rows[0]) : null;
      });

      const findExpiredWithStorageKey = Effect.fn('DropRepository.findExpiredWithStorageKey')(
        function* () {
          const rows = yield* query(
            db
              .select()
              .from(dropsTable)
              .where(and(lt(dropsTable.expiresAt, new Date()), isNotNull(dropsTable.storageKey)))
          );
          return yield* decodeDrops(rows);
        }
      );

      const deleteById = Effect.fn('DropRepository.deleteById')(function* (id: string) {
        yield* query(db.delete(dropsTable).where(eq(dropsTable.id, id)));
      });

      const clearStorageKey = Effect.fn('DropRepository.clearStorageKey')(function* (id: string) {
        yield* query(db.update(dropsTable).set({ storageKey: null }).where(eq(dropsTable.id, id)));
      });

      return { insert, findById, findExpiredWithStorageKey, deleteById, clearStorageKey };
    })
  );
}
