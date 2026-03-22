import { Schema } from 'effect';

export class InvalidInputError extends Schema.TaggedErrorClass('InvalidInputError')(
  'InvalidInputError',
  {
    message: Schema.String,
  }
) {}

export class FileTooLargeError extends Schema.TaggedErrorClass('FileTooLargeError')(
  'FileTooLargeError',
  {
    message: Schema.String,
    maxSize: Schema.Number,
    actualSize: Schema.Number,
  }
) {}

export class StorageError extends Schema.TaggedErrorClass('StorageError')('StorageError', {
  message: Schema.String,
  error: Schema.Defect,
}) {}
