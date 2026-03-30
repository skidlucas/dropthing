import { Schema } from 'effect';
import { MAX_TTL, MIN_TTL } from './constants.js';

export const UUID = Schema.String.pipe(Schema.check(Schema.isUUID()));

export const DropType = Schema.Literals(['file', 'text', 'link']);
export type DropType = typeof DropType.Type;

export const DropMetadata = Schema.Struct({
  language: Schema.optionalKey(Schema.String),
  title: Schema.optionalKey(Schema.String),
});

export type DropMetadata = typeof DropMetadata.Type;

export const Drop = Schema.Struct({
  id: UUID,
  type: DropType,
  content: Schema.NullOr(Schema.String),
  fileName: Schema.NullOr(Schema.String),
  mimeType: Schema.NullOr(Schema.String),
  size: Schema.NullOr(Schema.Int),
  storageKey: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(DropMetadata),
  encrypted: Schema.Boolean,
  createdAt: Schema.Date,
  expiresAt: Schema.Date,
});

export type Drop = typeof Drop.Type;

/** Wire format: JSON.stringify converts Date → ISO string */
export type DropJson = Omit<Drop, 'createdAt' | 'expiresAt'> & {
  createdAt: string;
  expiresAt: string;
};

export const UploadParams = Schema.Struct({
  type: DropType,
  expiresIn: Schema.NumberFromString.pipe(
    Schema.check(Schema.isBetween({ minimum: MIN_TTL, maximum: MAX_TTL }))
  ),
  encrypted: Schema.optionalKey(Schema.Literal('true')),
});

export type UploadParams = typeof UploadParams.Type;
