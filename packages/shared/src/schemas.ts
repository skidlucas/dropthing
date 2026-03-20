import { Schema } from 'effect';
import { MAX_TTL, MIN_TTL } from './constants';

export const UUID = Schema.String.pipe(Schema.check(Schema.isUUID()));

export const Drop = Schema.Struct({
  id: UUID,
  fileName: Schema.String,
  mimeType: Schema.String,
  size: Schema.Int,
  storageKey: Schema.String,
  createdAt: Schema.Date,
  expiresAt: Schema.Date,
});

export type Drop = typeof Drop.Type;

export const UploadParams = Schema.Struct({
  expiresIn: Schema.NumberFromString.pipe(
    Schema.check(Schema.isBetween({ minimum: MIN_TTL, maximum: MAX_TTL }))
  ),
});

export type UploadParams = typeof UploadParams.Type;
