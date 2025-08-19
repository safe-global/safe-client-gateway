import { z } from 'zod';

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 30;

export const makeNameSchema = (args?: {
  minLength?: number;
  maxLength?: number;
}): z.ZodString => {
  return z
    .string()
    .trim()
    .min(args?.minLength ?? NAME_MIN_LENGTH, {
      message: `Names must be at least ${args?.minLength ?? NAME_MIN_LENGTH} characters long`,
    })
    .max(args?.maxLength ?? NAME_MAX_LENGTH, {
      message: `Names must be at most ${args?.maxLength ?? NAME_MAX_LENGTH} characters long`,
    })
    .regex(/^[a-zA-Z0-9]+(?:[ ._-][a-zA-Z0-9]+)*$/, {
      message:
        'Names must start with a letter or number and can contain alphanumeric characters, spaces, periods, underscores, or hyphens',
    });
};

export const NameSchema = makeNameSchema();
