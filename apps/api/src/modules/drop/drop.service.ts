import path from 'node:path';
import { Effect, Layer, Schema, ServiceMap } from 'effect';
import type { Drop } from '@dropthing/shared';
import {
  DropExpiredError,
  DropNotFoundError,
  FileTooLargeError,
  InvalidInputError,
  MAX_FILE_SIZE,
  StorageError,
} from '@dropthing/shared';
import { DropRepository } from './drop.repository.js';
import type { DatabaseError } from '../../db/db.service.js';
import { StorageService } from '../storage/storage.service.js';

function generateStorageKey(fileName: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}/${month}/${day}/${crypto.randomUUID()}${path.extname(fileName)}`;
}

export type CreateDropInput =
  | { readonly type: 'file'; readonly file: File; readonly expiresIn: number }
  | { readonly type: 'text'; readonly content: string; readonly expiresIn: number }
  | { readonly type: 'link'; readonly content: string; readonly expiresIn: number };

type DropServiceShape = {
  readonly create: (
    input: CreateDropInput
  ) => Effect.Effect<
    Drop,
    InvalidInputError | FileTooLargeError | StorageError | DatabaseError | Schema.SchemaError
  >;
  readonly get: (
    id: string
  ) => Effect.Effect<
    Drop,
    DropNotFoundError | DropExpiredError | DatabaseError | Schema.SchemaError
  >;
  readonly getFile: (
    id: string
  ) => Effect.Effect<
    { drop: Drop; content: Uint8Array },
    | DropNotFoundError
    | DropExpiredError
    | InvalidInputError
    | StorageError
    | DatabaseError
    | Schema.SchemaError
  >;
  readonly delete: (
    id: string
  ) => Effect.Effect<void, DropNotFoundError | StorageError | DatabaseError | Schema.SchemaError>;
  readonly listExpired: () => Effect.Effect<
    ReadonlyArray<Drop>,
    DatabaseError | Schema.SchemaError
  >;
};

export class DropService extends ServiceMap.Service<DropService, DropServiceShape>()(
  '@dropthing/DropService'
) {
  static readonly layer = Layer.effect(
    DropService,
    Effect.gen(function* () {
      const repo = yield* DropRepository;
      const storage = yield* StorageService;

      const create = Effect.fn('DropService.create')(function* (input: CreateDropInput) {
        const expiresAt = new Date(Date.now() + input.expiresIn * 1000);

        if (input.type === 'file') {
          const { file } = input;

          if (file.size > MAX_FILE_SIZE) {
            return yield* new FileTooLargeError({
              message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
              maxSize: MAX_FILE_SIZE,
              actualSize: file.size,
            });
          }

          const storageKey = generateStorageKey(file.name);

          yield* storage.save(storageKey, file);

          return yield* repo.insert({
            type: input.type,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            storageKey,
            expiresAt,
          });
        }

        if (input.type === 'link') {
          yield* Schema.decodeUnknownEffect(Schema.URLFromString)(input.content).pipe(
            Effect.mapError(() => new InvalidInputError({ message: 'Invalid URL' }))
          );
        }

        return yield* repo.insert({
          type: input.type,
          content: input.content,
          expiresAt,
        });
      });

      const get = Effect.fn('DropService.get')(function* (id: string) {
        const drop = yield* repo.findById(id);
        if (!drop) {
          return yield* new DropNotFoundError({ id });
        }

        if (drop.expiresAt < new Date()) {
          return yield* new DropExpiredError({ id, expiredAt: drop.expiresAt });
        }

        return drop;
      });

      const getFile = Effect.fn('DropService.getFile')(function* (id: string) {
        const drop = yield* get(id);

        if (drop.type !== 'file' || !drop.storageKey) {
          return yield* new InvalidInputError({ message: 'Drop is not a file' });
        }

        const content = yield* storage.get(drop.storageKey);
        return { drop, content };
      });

      const del = Effect.fn('DropService.delete')(function* (id: string) {
        const drop = yield* repo.findById(id);
        if (!drop) {
          return yield* new DropNotFoundError({ id });
        }
        if (drop.storageKey) {
          yield* storage.delete(drop.storageKey);
        }
        yield* repo.deleteById(id);
      });

      const listExpired = Effect.fn('DropService.listExpired')(function* () {
        return yield* repo.findExpired();
      });

      return { create, get, getFile, delete: del, listExpired };
    })
  );
}
