import { Effect, Layer, Schema, ServiceMap } from 'effect';
import { StorageError } from '@dropthing/shared';
import { DropRepository } from '../drop/drop.repository.js';
import { StorageService } from '../storage/storage.service.js';
import type { DatabaseError } from '../../db/db.service.js';

type CleanupServiceShape = {
  readonly runOnce: () => Effect.Effect<void, DatabaseError | StorageError | Schema.SchemaError>;
};

export class CleanupService extends ServiceMap.Service<CleanupService, CleanupServiceShape>()(
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
            yield* dropRepo.clearStorageKey(drop.id);
          })
        );
        yield* Effect.all(deleteDropEffects, { concurrency: 5, discard: true });

        yield* Effect.log(`Cleaned up ${drops.length} drops`);
      });

      return { runOnce };
    })
  );
}
