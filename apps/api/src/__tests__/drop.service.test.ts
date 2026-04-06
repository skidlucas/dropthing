import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer, Stream } from 'effect';
import { DropService } from '../modules/drop/drop.service.js';
import { DropRepository, type InsertDropInput } from '../modules/drop/drop.repository.js';
import { StorageService } from '../modules/storage/storage.service.js';
import { AiService } from '../modules/ai/ai.service.js';
import type { Drop } from '@dropthing/shared';

function makeMocks() {
  let aiCalled = false;

  const MockAiService = Layer.succeed(AiService, {
    enrichDrop: (_content, _type) => {
      aiCalled = true;
      return Effect.succeed({ title: 'mock title' });
    },
  });

  const MockStorageService = Layer.succeed(StorageService, {
    save: (_key, _data) => Effect.void,
    saveStream: (_key, _stream, _size) => Effect.void,
    get: (_key) => Effect.succeed(new Uint8Array()),
    getStream: (_key) => Effect.succeed(Stream.fromIterable([new Uint8Array([1, 2, 3])])),
    delete: (_key) => Effect.void,
  });

  const MockDropRepository = Layer.succeed(DropRepository, {
    insert: (input: InsertDropInput) =>
      Effect.succeed({
        id: crypto.randomUUID(),
        type: input.type,
        content: input.content ?? null,
        fileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
        size: input.size ?? null,
        storageKey: input.storageKey ?? null,
        metadata: input.metadata ?? null,
        encrypted: input.encrypted ?? false,
        createdAt: new Date(),
        expiresAt: input.expiresAt,
      } satisfies Drop),
    findById: (_id) => Effect.succeed(null),
    findExpiredWithStorageKey: () => Effect.succeed([]),
    deleteById: (_id) => Effect.void,
    clearStorageKey: (_id) => Effect.void,
  });

  const TestLayer = DropService.layer.pipe(
    Layer.provide(Layer.mergeAll(MockAiService, MockStorageService, MockDropRepository))
  );

  return { TestLayer, wasAiCalled: () => aiCalled };
}

describe('DropService', () => {
  it.effect('encrypted text drop has null metadata and AI is never called', () => {
    const { TestLayer, wasAiCalled } = makeMocks();

    return Effect.gen(function* () {
      const service = yield* DropService;
      const result = yield* service.create({
        type: 'text',
        content: 'encrypted-ciphertext-base64',
        expiresIn: 3600,
        encrypted: true,
      });

      expect(result.metadata).toBeNull();
      expect(result.encrypted).toBe(true);
      expect(wasAiCalled()).toBe(false);
    }).pipe(Effect.provide(TestLayer));
  });

  it.effect('encrypted file drop has null metadata and AI is never called', () => {
    const { TestLayer, wasAiCalled } = makeMocks();

    return Effect.gen(function* () {
      const service = yield* DropService;
      const result = yield* service.create({
        type: 'file',
        file: new File(['encrypted-data'], 'encrypted.bin', { type: 'application/octet-stream' }),
        expiresIn: 3600,
        encrypted: true,
      });

      expect(result.metadata).toBeNull();
      expect(result.encrypted).toBe(true);
      expect(wasAiCalled()).toBe(false);
    }).pipe(Effect.provide(TestLayer));
  });

  it.effect('non-encrypted link drop validates URL and has encrypted: false', () => {
    const { TestLayer } = makeMocks();

    return Effect.gen(function* () {
      const service = yield* DropService;
      const result = yield* service.create({
        type: 'link',
        content: 'https://example.com',
        expiresIn: 3600,
      });

      expect(result.encrypted).toBe(false);
    }).pipe(Effect.provide(TestLayer));
  });

  it.effect('encrypted link drop skips URL validation and AI enrichment', () => {
    const { TestLayer, wasAiCalled } = makeMocks();

    return Effect.gen(function* () {
      const service = yield* DropService;
      const result = yield* service.create({
        type: 'link',
        content: 'not-a-url-just-ciphertext',
        expiresIn: 3600,
        encrypted: true,
      });

      expect(result.encrypted).toBe(true);
      expect(result.metadata).toBeNull();
      expect(wasAiCalled()).toBe(false);
    }).pipe(Effect.provide(TestLayer));
  });

  it.effect('non-encrypted text drop calls AI enrichment', () => {
    const { TestLayer, wasAiCalled } = makeMocks();

    return Effect.gen(function* () {
      const service = yield* DropService;
      const result = yield* service.create({
        type: 'text',
        content: 'console.log("hello world")',
        expiresIn: 3600,
      });

      expect(wasAiCalled()).toBe(true);
      expect(result.metadata).toEqual({ title: 'mock title' });
      expect(result.encrypted).toBe(false);
    }).pipe(Effect.provide(TestLayer));
  });
});
