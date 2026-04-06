import { mkdir, unlink } from 'node:fs/promises';
import { Effect, Layer, Stream } from 'effect';
import { StorageService } from './storage.service';
import { StorageError } from '@dropthing/shared';

const UPLOADS_DIR = './uploads';

export const LocalStorageLayer = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => mkdir(UPLOADS_DIR, { recursive: true }),
      catch: (error) => new StorageError({ message: 'Failed to create uploads directory', error }),
    });

    const save = Effect.fn('StorageService.save')(function* (key: string, data: Blob) {
      yield* Effect.tryPromise({
        try: () => Bun.write(`${UPLOADS_DIR}/${key}`, data),
        catch: (error) => new StorageError({ message: 'Failed to save file', error }),
      });
    });

    const presign = (_key: string, _contentType: string) => Effect.succeed(null as string | null);

    const exists = Effect.fn('StorageService.exists')(function* (key: string) {
      return yield* Effect.tryPromise({
        try: () => Bun.file(`${UPLOADS_DIR}/${key}`).exists(),
        catch: (error) => new StorageError({ message: 'Failed to check file', error }),
      });
    });

    const get = Effect.fn('StorageService.get')(function* (key: string) {
      return yield* Effect.tryPromise({
        try: async () => {
          const file = Bun.file(`${UPLOADS_DIR}/${key}`);
          const buffer = await file.arrayBuffer();
          return new Uint8Array(buffer);
        },
        catch: (error) => new StorageError({ message: 'Failed to read file', error }),
      });
    });

    const getStream = Effect.fn('StorageService.getStream')(function* (key: string) {
      const file = Bun.file(`${UPLOADS_DIR}/${key}`);

      const fileExists = yield* Effect.tryPromise({
        try: () => file.exists(),
        catch: (error) => new StorageError({ message: 'Failed to check file', error }),
      });
      if (!fileExists) {
        return yield* new StorageError({
          message: `File not found: ${key}`,
          error: new Error('ENOENT'),
        });
      }

      return Stream.fromReadableStream({
        evaluate: () => file.stream(),
        onError: (error) => new StorageError({ message: 'Stream read failed', error }),
      });
    });

    const del = Effect.fn('StorageService.delete')(function* (key: string) {
      yield* Effect.tryPromise({
        try: () => unlink(`${UPLOADS_DIR}/${key}`),
        catch: (error) => new StorageError({ message: 'Failed to delete file', error }),
      });
    });

    return { save, presign, exists, get, getStream, delete: del };
  })
);
