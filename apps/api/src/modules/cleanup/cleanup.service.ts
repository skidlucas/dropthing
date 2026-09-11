import { Effect, Layer, Schema, Context } from 'effect';
import { StorageError } from '@dropthing/shared';
import { DropRepository } from '../drop/drop.repository.js';
import { StorageService } from '../storage/storage.service.js';
import type { DatabaseError } from '../../db/db.service.js';

type CleanupServiceShape = {
  readonly runOnce: () => Effect.Effect<void, DatabaseError | StorageError | Schema.SchemaError>;
};

export class CleanupService extends Context.Service<CleanupService, CleanupServiceShape>()(
  '@dropthing/CleanupService'
) {
  static readonly layer = Layer.effect(
    CleanupService,
    Effect.gen(function* () {
      const dropRepo = yield* DropRepository;
      const storageService = yield* StorageService;
      const runOnce = Effect.fn('CleanupService.runOnce')(function* () {
        const drops = yield* dropRepo.findExpiredWithStorageKey();
        const deleteDropEffects = drops.map((drop) =>
          Effect.gen(function* () {
            yield* storageService.delete(drop.storageKey!);
            yield* dropRepo.clearStorageKey(drop.id, drop.storageKey!);
          })
        );
        yield* Effect.all(deleteDropEffects, { concurrency: 5, discard: true });

        const abandoned = yield* dropRepo.findExpiredUploadIntents();
        yield* Effect.all(
          abandoned.map((key) =>
            Effect.gen(function* () {
              yield* storageService.delete(key);
              yield* dropRepo.deleteUploadIntent(key);
            })
          ),
          { concurrency: 5, discard: true }
        );

        yield* Effect.log(
          `Cleaned up ${drops.length} drops and ${abandoned.length} abandoned uploads`
        );
      });

      return { runOnce };
    })
  );
}
