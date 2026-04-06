import { Effect, ServiceMap, Stream } from 'effect';
import { StorageError } from '@dropthing/shared';

type StorageServiceShape = {
  readonly save: (key: string, data: Blob) => Effect.Effect<void, StorageError>;
  readonly saveStream: (
    key: string,
    stream: ReadableStream<Uint8Array>,
    size: number
  ) => Effect.Effect<void, StorageError>;
  readonly get: (key: string) => Effect.Effect<Uint8Array, StorageError>;
  readonly getStream: (
    key: string
  ) => Effect.Effect<Stream.Stream<Uint8Array, StorageError>, StorageError>;
  readonly delete: (key: string) => Effect.Effect<void, StorageError>;
};

export class StorageService extends ServiceMap.Service<StorageService, StorageServiceShape>()(
  '@dropthing/StorageService'
) {}
