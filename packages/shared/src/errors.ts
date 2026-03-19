import { Schema } from 'effect';

export class InvalidInputError extends Schema.TaggedErrorClass('InvalidInputError')(
  'InvalidInputError',
  {
    message: Schema.String,
  }
) {}
