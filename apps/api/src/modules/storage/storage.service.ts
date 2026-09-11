import { Effect, Context } from 'effect';
import { StorageError } from '@dropthing/shared';

type StorageServiceShape = {
  readonly save: (key: string, data: Blob) => Effect.Effect<void, StorageError>;
  readonly presign: (
    key: string,
    contentType: string
  ) => Effect.Effect<string | null, StorageError>;
  readonly exists: (key: string) => Effect.Effect<boolean, StorageError>;
  readonly head: (
    key: string
  ) => Effect.Effect<{ size: number; contentType: string | null } | null, StorageError>;
  readonly get: (key: string) => Effect.Effect<Uint8Array, StorageError>;
  readonly getStream: (key: string) => Effect.Effect<ReadableStream<Uint8Array>, StorageError>;
  readonly delete: (key: string) => Effect.Effect<void, StorageError>;
};

export class StorageService extends Context.Service<StorageService, StorageServiceShape>()(
  '@dropthing/StorageService'
) {}
