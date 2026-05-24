import { Effect, Layer, Schema, Context } from 'effect';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import type { EffectDrizzleQueryError } from 'drizzle-orm/effect-core';
import type { DropType, DropMetadata } from '@dropthing/shared';
import { Drop } from '@dropthing/shared';
import { dropsTable } from '../../db/schema.js';
import { DropInsert, DropSelect, DropSelectArray } from '../../db/effect-schema.js';
import { DrizzleService } from '../../db/db.service.js';

const decodeDropInsert = Schema.decodeUnknownEffect(DropInsert);
const decodeDropSelect = Schema.decodeUnknownEffect(DropSelect);
const decodeDropSelectArray = Schema.decodeUnknownEffect(DropSelectArray);
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

type DropRepositoryError = EffectDrizzleQueryError | Schema.SchemaError;

type DropRepositoryShape = {
  readonly insert: (input: InsertDropInput) => Effect.Effect<Drop, DropRepositoryError>;
  readonly findById: (id: string) => Effect.Effect<Drop | null, DropRepositoryError>;
  readonly findExpiredWithStorageKey: () => Effect.Effect<ReadonlyArray<Drop>, DropRepositoryError>;
  readonly deleteById: (id: string) => Effect.Effect<void, EffectDrizzleQueryError>;
  readonly clearStorageKey: (id: string) => Effect.Effect<void, EffectDrizzleQueryError>;
};

export class DropRepository extends Context.Service<DropRepository, DropRepositoryShape>()(
  '@dropthing/DropRepository'
) {
  static readonly layer = Layer.effect(
    DropRepository,
    Effect.gen(function* () {
      const db = yield* DrizzleService;

      const insert = Effect.fn('DropRepository.insert')(function* (input: InsertDropInput) {
        const row: typeof dropsTable.$inferInsert = {
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

        yield* decodeDropInsert(row);
        yield* db.insert(dropsTable).values(row);

        return yield* decodeDrop(row);
      });

      const findById = Effect.fn('DropRepository.findById')(function* (id: string) {
        const rows = yield* db.select().from(dropsTable).where(eq(dropsTable.id, id));
        const row = rows[0] ? yield* decodeDropSelect(rows[0]) : null;
        return row ? yield* decodeDrop(row) : null;
      });

      const findExpiredWithStorageKey = Effect.fn('DropRepository.findExpiredWithStorageKey')(
        function* () {
          const rows = yield* db
            .select()
            .from(dropsTable)
            .where(and(lt(dropsTable.expiresAt, new Date()), isNotNull(dropsTable.storageKey)));
          const validatedRows = yield* decodeDropSelectArray(rows);
          return yield* decodeDrops(validatedRows);
        }
      );

      const deleteById = Effect.fn('DropRepository.deleteById')(function* (id: string) {
        yield* db.delete(dropsTable).where(eq(dropsTable.id, id));
      });

      const clearStorageKey = Effect.fn('DropRepository.clearStorageKey')(function* (id: string) {
        yield* db.update(dropsTable).set({ storageKey: null }).where(eq(dropsTable.id, id));
      });

      return { insert, findById, findExpiredWithStorageKey, deleteById, clearStorageKey };
    })
  );
}
