import { S3Client } from 'bun';
import { Effect, Layer, Stream } from 'effect';
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
          bucket: `${process.env.R2_BUCKET}/${process.env.R2_ENV}`,
        }),
      catch: (error) => new StorageError({ message: 'Failed to create S3 client', error }),
    });

    const save = Effect.fn('StorageService.save')(function* (key: string, data: Blob) {
      yield* Effect.tryPromise({
        try: () => s3Client.write(key, data),
        catch: (error) => new StorageError({ message: 'Failed to save file', error }),
      });
    });

    const presign = Effect.fn('StorageService.presign')(function* (
      key: string,
      contentType: string
    ) {
      return yield* Effect.try({
        try: () => s3Client.presign(key, { method: 'PUT', expiresIn: 600, type: contentType }),
        catch: (error) => new StorageError({ message: 'Failed to generate presigned URL', error }),
      });
    });

    const exists = Effect.fn('StorageService.exists')(function* (key: string) {
      return yield* Effect.tryPromise({
        try: () => s3Client.file(key).exists(),
        catch: (error) => new StorageError({ message: 'Failed to check file existence', error }),
      });
    });

    const get = Effect.fn('StorageService.get')(function* (key: string) {
      return yield* Effect.tryPromise({
        try: () => s3Client.file(key).bytes(),
        catch: (error) => new StorageError({ message: 'Failed to get file', error }),
      });
    });

    const getStream = Effect.fn('StorageService.getStream')(function* (key: string) {
      const s3File = s3Client.file(key);

      const fileExists = yield* Effect.tryPromise({
        try: () => s3File.exists(),
        catch: (error) => new StorageError({ message: 'Failed to check S3 file', error }),
      });
      if (!fileExists) {
        return yield* new StorageError({
          message: `S3 file not found: ${key}`,
          error: new Error('NOT_FOUND'),
        });
      }

      return Stream.fromReadableStream({
        evaluate: () => s3File.stream(),
        onError: (error) => new StorageError({ message: 'S3 stream read failed', error }),
      });
    });

    const del = Effect.fn('StorageService.delete')(function* (key: string) {
      yield* Effect.tryPromise({
        try: () => s3Client.delete(key),
        catch: (error) => new StorageError({ message: 'Failed to delete file', error }),
      });
    });

    return { save, presign, exists, get, getStream, delete: del };
  })
);
