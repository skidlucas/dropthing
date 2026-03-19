import { Schema } from 'effect';

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
