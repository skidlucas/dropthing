import { Data } from 'effect';

export class InvalidInputError extends Data.TaggedError('InvalidInputError')<{
  message: string;
}> {}
