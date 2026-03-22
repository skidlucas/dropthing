import { S3Client } from 'bun';
import { Effect, Layer } from 'effect';
import { StorageService } from './storage.service.js';
import { StorageError } from '@dropthing/shared';

export const R2StorageLayer = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const s3Client = yield* Effect.try({
      try: () =>
        new S3Client({
          endpoint: process.env.R2_ENDPOINT!,
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
          bucket: process.env.R2_BUCKET!,
        }),
      catch: (error) => new StorageError({ message: 'Failed to create S3 client', error }),
    });

    const save = Effect.fn('StorageService.save')(function* (key: string, data: Blob) {
      yield* Effect.tryPromise({
        try: () => s3Client.write(key, data),
        catch: (error) => new StorageError({ message: 'Failed to save file', error }),
      });
    });

    const get = Effect.fn('StorageService.get')(function* (key: string) {
      return yield* Effect.tryPromise({
        try: () => s3Client.file(key).bytes(),
        catch: (error) => new StorageError({ message: 'Failed to get file', error }),
      });
    });

    const del = Effect.fn('StorageService.delete')(function* (key: string) {
      yield* Effect.tryPromise({
        try: () => s3Client.delete(key),
        catch: (error) => new StorageError({ message: 'Failed to delete file', error }),
      });
    });

    return { save, get, delete: del };
  })
);
