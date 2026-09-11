import { Effect, Layer } from 'effect';
import { AwsClient } from 'aws4fetch';
import { StorageError } from '@dropthing/shared';
import { StorageService } from './storage.service.js';

export interface R2StorageConfig {
  readonly bucket: R2Bucket;
  readonly bucketName: string;
  readonly prefix: string;
  readonly accountId?: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly localOrigin?: string;
}
const storageFailure = (message: string, error: unknown) => new StorageError({ message, error });
const fullKey = (prefix: string, key: string) =>
  `${prefix.replace(/^\/+|\/+$/g, '')}/${key.replace(/^\/+/, '')}`;

export const makeR2StorageLayer = (config: R2StorageConfig) =>
  Layer.succeed(StorageService, {
    save: (key, data) =>
      Effect.tryPromise({
        try: () =>
          config.bucket
            .put(fullKey(config.prefix, key), data, {
              httpMetadata: { contentType: data.type || 'application/octet-stream' },
            })
            .then(() => undefined),
        catch: (e) => storageFailure('Failed to save file', e),
      }),
    presign: (key, contentType) =>
      Effect.tryPromise({
        try: async () => {
          if (config.localOrigin)
            return `${config.localOrigin}/api/uploads/${encodeURIComponent(key)}`;
          if (!config.accountId || !config.accessKeyId || !config.secretAccessKey)
            throw new Error('R2 S3 signing credentials are not configured');
          const endpoint = new URL(
            `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${fullKey(config.prefix, key)}`
          );
          endpoint.searchParams.set('X-Amz-Expires', '600');
          const client = new AwsClient({
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            service: 's3',
            region: 'auto',
          });
          const signed = await client.sign(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            aws: { signQuery: true, allHeaders: true },
          });
          return signed.url;
        },
        catch: (e) => storageFailure('Failed to generate upload URL', e),
      }),
    exists: (key) =>
      Effect.tryPromise({
        try: async () => (await config.bucket.head(fullKey(config.prefix, key))) !== null,
        catch: (e) => storageFailure('Failed to check file', e),
      }),
    head: (key) =>
      Effect.tryPromise({
        try: async () => {
          const object = await config.bucket.head(fullKey(config.prefix, key));
          return object
            ? { size: object.size, contentType: object.httpMetadata?.contentType ?? null }
            : null;
        },
        catch: (e) => storageFailure('Failed to inspect file', e),
      }),
    get: (key) =>
      Effect.tryPromise({
        try: async () => {
          const object = await config.bucket.get(fullKey(config.prefix, key));
          if (!object) throw new Error('NOT_FOUND');
          return new Uint8Array(await object.arrayBuffer());
        },
        catch: (e) => storageFailure('Failed to get file', e),
      }),
    getStream: (key) =>
      Effect.tryPromise({
        try: async () => {
          const object = await config.bucket.get(fullKey(config.prefix, key));
          if (!object) throw new Error('NOT_FOUND');
          return object.body;
        },
        catch: (e) => storageFailure('Failed to open file stream', e),
      }),
    delete: (key) =>
      Effect.tryPromise({
        try: () => config.bucket.delete(fullKey(config.prefix, key)),
        catch: (e) => storageFailure('Failed to delete file', e),
      }),
  });

export const objectKey = fullKey;
