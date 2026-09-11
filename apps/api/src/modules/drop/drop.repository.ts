import { Context, Effect, Layer, Schema } from 'effect';
import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import type { Drop, DropMetadata, DropType } from '@dropthing/shared';
import { DrizzleService, d1Effect, type DatabaseError } from '../../db/db.service.js';
import { dropsTable, uploadIntentsTable } from '../../db/schema.js';

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
export interface UploadIntentInput {
  readonly storageKey: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly declaredSize: number;
}
type RepoError = DatabaseError | Schema.SchemaError;
type Shape = {
  readonly insert: (input: InsertDropInput) => Effect.Effect<Drop, RepoError>;
  readonly findById: (id: string) => Effect.Effect<Drop | null, RepoError>;
  readonly findExpiredWithStorageKey: (
    limit?: number
  ) => Effect.Effect<ReadonlyArray<Drop>, RepoError>;
  readonly deleteById: (id: string) => Effect.Effect<void, DatabaseError>;
  readonly clearStorageKey: (id: string, key: string) => Effect.Effect<void, DatabaseError>;
  readonly createUploadIntent: (input: UploadIntentInput) => Effect.Effect<void, DatabaseError>;
  readonly consumeUploadIntent: (input: UploadIntentInput) => Effect.Effect<boolean, DatabaseError>;
  readonly findExpiredUploadIntents: (
    limit?: number
  ) => Effect.Effect<ReadonlyArray<string>, DatabaseError>;
  readonly deleteUploadIntent: (key: string) => Effect.Effect<void, DatabaseError>;
};
const toDrop = (row: typeof dropsTable.$inferSelect): Drop => ({
  ...row,
  metadata: row.metadata ?? null,
});

export class DropRepository extends Context.Service<DropRepository, Shape>()(
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
        yield* Schema.decodeUnknownEffect(
          Schema.Struct({ id: Schema.String, type: Schema.String })
        )(row);
        yield* d1Effect('insert drop', () => db.insert(dropsTable).values(row));
        return toDrop(row as typeof dropsTable.$inferSelect);
      });
      const findById = Effect.fn('DropRepository.findById')(function* (id: string) {
        const rows = yield* d1Effect('find drop', () =>
          db.select().from(dropsTable).where(eq(dropsTable.id, id)).limit(1)
        );
        return rows[0] ? toDrop(rows[0]) : null;
      });
      const findExpiredWithStorageKey = Effect.fn('DropRepository.findExpiredWithStorageKey')(
        function* (limit = 100) {
          const rows = yield* d1Effect('find expired drops', () =>
            db
              .select()
              .from(dropsTable)
              .where(and(lt(dropsTable.expiresAt, new Date()), isNotNull(dropsTable.storageKey)))
              .limit(limit)
          );
          return rows.map(toDrop);
        }
      );
      const deleteById = (id: string) =>
        d1Effect('delete drop', () => db.delete(dropsTable).where(eq(dropsTable.id, id))).pipe(
          Effect.asVoid
        );
      const clearStorageKey = (id: string, key: string) =>
        d1Effect('clear storage key', () =>
          db
            .update(dropsTable)
            .set({ storageKey: null })
            .where(and(eq(dropsTable.id, id), eq(dropsTable.storageKey, key)))
        ).pipe(Effect.asVoid);
      const createUploadIntent = (input: UploadIntentInput) =>
        d1Effect('create upload intent', () =>
          db.insert(uploadIntentsTable).values({
            ...input,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60_000),
            consumedAt: null,
          })
        ).pipe(Effect.asVoid);
      const consumeUploadIntent = Effect.fn('DropRepository.consumeUploadIntent')(function* (
        input: UploadIntentInput
      ) {
        const rows = yield* d1Effect('find upload intent', () =>
          db
            .select()
            .from(uploadIntentsTable)
            .where(
              and(
                eq(uploadIntentsTable.storageKey, input.storageKey),
                eq(uploadIntentsTable.fileName, input.fileName),
                eq(uploadIntentsTable.mimeType, input.mimeType),
                eq(uploadIntentsTable.declaredSize, input.declaredSize),
                isNull(uploadIntentsTable.consumedAt)
              )
            )
            .limit(1)
        );
        const row = rows[0];
        if (!row || row.expiresAt <= new Date()) return false;
        const result = yield* d1Effect('consume upload intent', () =>
          db
            .update(uploadIntentsTable)
            .set({ consumedAt: new Date() })
            .where(
              and(
                eq(uploadIntentsTable.storageKey, input.storageKey),
                isNull(uploadIntentsTable.consumedAt)
              )
            )
        );
        return result.meta.changes === 1;
      });
      const findExpiredUploadIntents = Effect.fn('DropRepository.findExpiredUploadIntents')(
        function* (limit = 100) {
          const rows = yield* d1Effect('find abandoned uploads', () =>
            db
              .select({ storageKey: uploadIntentsTable.storageKey })
              .from(uploadIntentsTable)
              .where(
                and(
                  lt(uploadIntentsTable.expiresAt, new Date()),
                  isNull(uploadIntentsTable.consumedAt)
                )
              )
              .limit(limit)
          );
          return rows.map((row) => row.storageKey);
        }
      );
      const deleteUploadIntent = (key: string) =>
        d1Effect('delete upload intent', () =>
          db
            .delete(uploadIntentsTable)
            .where(
              and(eq(uploadIntentsTable.storageKey, key), isNull(uploadIntentsTable.consumedAt))
            )
        ).pipe(Effect.asVoid);
      return {
        insert,
        findById,
        findExpiredWithStorageKey,
        deleteById,
        clearStorageKey,
        createUploadIntent,
        consumeUploadIntent,
        findExpiredUploadIntents,
        deleteUploadIntent,
      };
    })
  );
}
