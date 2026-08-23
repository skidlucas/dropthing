import { Schema } from 'effect';

export class InvalidInputError extends Schema.TaggedError<InvalidInputError>()(
  'InvalidInputError',
  {
    message: Schema.String,
  }
) {}

export class FileTooLargeError extends Schema.TaggedError<FileTooLargeError>()(
  'FileTooLargeError',
  {
    message: Schema.String,
    maxSize: Schema.Number,
    actualSize: Schema.Number,
  }
) {}

export class StorageError extends Schema.TaggedError<StorageError>()('StorageError', {
  message: Schema.String,
  error: Schema.Defect(),
}) {}

export class DropNotFoundError extends Schema.TaggedError<DropNotFoundError>()(
  'DropNotFoundError',
  {
    id: Schema.String,
  }
) {}

export class DropExpiredError extends Schema.TaggedError<DropExpiredError>()('DropExpiredError', {
  id: Schema.String,
  expiredAt: Schema.Date,
}) {}

export class AiError extends Schema.TaggedError<AiError>()('AiError', {
  message: Schema.String,
  error: Schema.Defect(),
}) {}
