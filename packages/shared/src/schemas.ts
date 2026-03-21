import { Schema } from 'effect';
import { MAX_TTL, MIN_TTL } from './constants.js';

export const UUID = Schema.String.pipe(Schema.check(Schema.isUUID()));

export const DropType = Schema.Literals(['file', 'text', 'link']);
export type DropType = typeof DropType.Type;

export const Drop = Schema.Struct({
  id: UUID,
  type: DropType,
  content: Schema.NullOr(Schema.String),
  fileName: Schema.NullOr(Schema.String),
  mimeType: Schema.NullOr(Schema.String),
  size: Schema.NullOr(Schema.Int),
  storageKey: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  expiresAt: Schema.Date,
});

export type Drop = typeof Drop.Type;

export const UploadParams = Schema.Struct({
  type: DropType,
  expiresIn: Schema.NumberFromString.pipe(
    Schema.check(Schema.isBetween({ minimum: MIN_TTL, maximum: MAX_TTL }))
  ),
});

export type UploadParams = typeof UploadParams.Type;
