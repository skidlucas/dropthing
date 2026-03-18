import { Schema } from 'effect';

export const Drop = Schema.Struct({
  id: Schema.UUID,
  fileName: Schema.String,
  mimeType: Schema.String,
  size: Schema.Int,
  storageKey: Schema.String,
  createdAt: Schema.DateFromSelf,
  expiresAt: Schema.DateFromSelf,
});

export type Drop = typeof Drop.Type;
