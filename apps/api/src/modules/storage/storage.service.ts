import { Effect, ServiceMap } from 'effect';
import { StorageError } from '@dropthing/shared';

type StorageServiceShape = {
  readonly save: (key: string, data: Blob) => Effect.Effect<void, StorageError>;
  readonly get: (key: string) => Effect.Effect<Uint8Array, StorageError>;
  readonly delete: (key: string) => Effect.Effect<void, StorageError>;
};

export class StorageService extends ServiceMap.Service<StorageService, StorageServiceShape>()(
  '@dropthing/StorageService'
) {}
