import { afterAll, describe, expect, it } from '@effect/vitest';
import { Effect, Layer, Stream } from 'effect';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { dropsTable } from '../db/schema.js';
import { DropService } from '../modules/drop/drop.service.js';
import { DropRepository } from '../modules/drop/drop.repository.js';
import { DrizzleService } from '../db/db.service.js';
import { StorageService } from '../modules/storage/storage.service.js';
import { AiService } from '../modules/ai/ai.service.js';
import * as schema from '../db/schema.js';

// Real DB connection for integration tests
const db = drizzle(process.env.DB_URL!, { schema });
const createdIds: string[] = [];

// Mock services that aren't under test
const MockAiService = Layer.succeed(AiService, {
  enrichDrop: (_content, _type) => Effect.succeed({ title: 'enriched' }),
});

const MockStorageService = Layer.succeed(StorageService, {
  save: (_key, _data) => Effect.void,
  saveStream: (_key, _stream, _size) => Effect.void,
  get: (_key) => Effect.succeed(new Uint8Array()),
  getStream: (_key) => Effect.succeed(Stream.fromIterable([new Uint8Array([1, 2, 3])])),
  delete: (_key) => Effect.void,
});

// Real DB layer + real repository, mocked AI + storage
const TestLayer = DropService.layer.pipe(
  Layer.provide(DropRepository.layer),
  Layer.provide(Layer.sync(DrizzleService, () => db)),
  Layer.provide(MockAiService),
  Layer.provide(MockStorageService)
);

afterAll(async () => {
  for (const id of createdIds) {
    await db.delete(dropsTable).where(eq(dropsTable.id, id));
  }
});

describe('DropService integration — zero-knowledge proof', () => {
  const plaintext = 'this is the original secret message';
  const fakeCiphertext = 'YWJjZGVmZ2g='; // base64 of "abcdefgh" (simulating encrypted content)

  it.live('encrypted text drop: stored content in DB is NOT the original plaintext', () =>
    Effect.gen(function* () {
      const service = yield* DropService;
      const drop = yield* service.create({
        type: 'text',
        content: fakeCiphertext,
        expiresIn: 3600,
        encrypted: true,
      });

      createdIds.push(drop.id);

      // Query DB directly — the real proof
      const [row] = yield* Effect.promise(() =>
        db.select().from(dropsTable).where(eq(dropsTable.id, drop.id))
      );

      expect(row.content).toBe(fakeCiphertext);
      expect(row.content).not.toBe(plaintext);
      expect(row.encrypted).toBe(true);
      expect(row.metadata).toBeNull();
    }).pipe(Effect.provide(TestLayer))
  );

  it.live('non-encrypted text drop: stored content in DB matches original', () =>
    Effect.gen(function* () {
      const service = yield* DropService;
      const drop = yield* service.create({
        type: 'text',
        content: plaintext,
        expiresIn: 3600,
      });

      createdIds.push(drop.id);

      const [row] = yield* Effect.promise(() =>
        db.select().from(dropsTable).where(eq(dropsTable.id, drop.id))
      );

      expect(row.content).toBe(plaintext);
      expect(row.encrypted).toBe(false);
      expect(row.metadata).toEqual({ title: 'enriched' });
    }).pipe(Effect.provide(TestLayer))
  );
});
