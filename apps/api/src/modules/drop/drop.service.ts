import path from 'node:path';
import { Effect, Layer, Schema, ServiceMap, Stream } from 'effect';
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
import { AiService } from '../ai/ai.service.js';

export function generateStorageKey(fileName: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}/${month}/${day}/${crypto.randomUUID()}${path.extname(fileName)}`;
}

export type CreateDropInput =
  | {
      readonly type: 'file';
      readonly file: File;
      readonly expiresIn: number;
      readonly encrypted?: boolean;
    }
  | {
      readonly type: 'text';
      readonly content: string;
      readonly expiresIn: number;
      readonly encrypted?: boolean;
    }
  | {
      readonly type: 'link';
      readonly content: string;
      readonly expiresIn: number;
      readonly encrypted?: boolean;
    };

export interface ConfirmUploadInput {
  readonly storageKey: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly expiresIn: number;
  readonly encrypted: boolean;
}

type DropServiceShape = {
  readonly create: (
    input: CreateDropInput
  ) => Effect.Effect<
    Drop,
    InvalidInputError | FileTooLargeError | StorageError | DatabaseError | Schema.SchemaError
  >;
  readonly presignUpload: (input: {
    fileName: string;
    mimeType: string;
    size: number;
  }) => Effect.Effect<
    { uploadUrl: string; storageKey: string },
    InvalidInputError | FileTooLargeError | StorageError
  >;
  readonly confirmUpload: (
    input: ConfirmUploadInput
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
  readonly getFileStream: (
    id: string
  ) => Effect.Effect<
    { drop: Drop; stream: Stream.Stream<Uint8Array, StorageError> },
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
};

export class DropService extends ServiceMap.Service<DropService, DropServiceShape>()(
  '@dropthing/DropService'
) {
  static readonly layer = Layer.effect(
    DropService,
    Effect.gen(function* () {
      const repo = yield* DropRepository;
      const storage = yield* StorageService;
      const ai = yield* AiService;

      const create = Effect.fn('DropService.create')(function* (input: CreateDropInput) {
        const expiresAt = new Date(Date.now() + input.expiresIn * 1000);

        if (input.type === 'file') {
          const { file } = input;

          if (file.size > MAX_FILE_SIZE) {
            return yield* new FileTooLargeError({
              message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024 / 1024}GB limit`,
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
            metadata: null,
            encrypted: input.encrypted ?? false,
            expiresAt,
          });
        }

        const encrypted = input.encrypted ?? false;

        if (input.type === 'link' && !encrypted) {
          yield* Schema.decodeUnknownEffect(Schema.URLFromString)(input.content).pipe(
            Effect.mapError(() => new InvalidInputError({ message: 'Invalid URL' }))
          );
        }

        const metadata = encrypted
          ? null
          : yield* ai.enrichDrop(input.content, input.type).pipe(
              Effect.catch((error) =>
                Effect.gen(function* () {
                  yield* Effect.logWarning('AI enrichment failed', error);
                  return null;
                })
              )
            );

        return yield* repo.insert({
          type: input.type,
          content: input.content,
          metadata,
          encrypted,
          expiresAt,
        });
      });

      const presignUpload = Effect.fn('DropService.presignUpload')(function* (input: {
        fileName: string;
        mimeType: string;
        size: number;
      }) {
        if (input.size > MAX_FILE_SIZE) {
          return yield* new FileTooLargeError({
            message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024 / 1024}GB limit`,
            maxSize: MAX_FILE_SIZE,
            actualSize: input.size,
          });
        }

        const storageKey = generateStorageKey(input.fileName);
        const uploadUrl = yield* storage.presign(storageKey, input.mimeType);

        if (!uploadUrl) {
          return yield* new InvalidInputError({
            message: 'Presigned uploads not available (local storage mode)',
          });
        }

        return { uploadUrl, storageKey };
      });

      const confirmUpload = Effect.fn('DropService.confirmUpload')(function* (
        input: ConfirmUploadInput
      ) {
        if (input.size > MAX_FILE_SIZE) {
          return yield* new FileTooLargeError({
            message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024 / 1024}GB limit`,
            maxSize: MAX_FILE_SIZE,
            actualSize: input.size,
          });
        }

        const fileExists = yield* storage.exists(input.storageKey);
        if (!fileExists) {
          return yield* new InvalidInputError({
            message: 'File not found in storage — upload may have failed',
          });
        }

        const expiresAt = new Date(Date.now() + input.expiresIn * 1000);

        return yield* repo.insert({
          type: 'file',
          fileName: input.fileName,
          mimeType: input.mimeType,
          size: input.size,
          storageKey: input.storageKey,
          metadata: null,
          encrypted: input.encrypted,
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

      const getFileStream = Effect.fn('DropService.getFileStream')(function* (id: string) {
        const drop = yield* get(id);

        if (drop.type !== 'file' || !drop.storageKey) {
          return yield* new InvalidInputError({ message: 'Drop is not a file' });
        }

        const stream = yield* storage.getStream(drop.storageKey);
        return { drop, stream };
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

      return { create, presignUpload, confirmUpload, get, getFile, getFileStream, delete: del };
    })
  );
}
