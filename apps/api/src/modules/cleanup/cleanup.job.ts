import { Effect, Schedule } from 'effect';
import { CleanupService } from './cleanup.service.js';

/** Background cleanup job: purge expired file storage every 5 minutes */
export const cleanupJob = Effect.gen(function* () {
  const cleanup = yield* CleanupService;
  yield* cleanup.runOnce().pipe(
    Effect.catch(() => Effect.void),
    Effect.tap(() => Effect.log('Cleanup job completed')),
    Effect.repeat(Schedule.spaced('5 minutes'))
  );
});
