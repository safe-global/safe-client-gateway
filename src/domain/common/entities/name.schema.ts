import { z } from 'zod';

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 30;

export const NameSchema = z
  .string()
  .trim()
  .min(NAME_MIN_LENGTH, {
    message: `Names must be at least ${NAME_MIN_LENGTH} characters long`,
  })
  .max(NAME_MAX_LENGTH, {
    message: `Names must be at most ${NAME_MAX_LENGTH} characters long`,
  })
  .regex(/^[a-zA-Z0-9]+(?:[ ._-][a-zA-Z0-9]+)*$/, {
    message:
      'Names must start with a letter or number and can contain alphanumeric characters, spaces, periods, underscores, or hyphens',
  });
