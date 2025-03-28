import { z } from 'zod';

export const NameSchema = z
  .string()
  .min(3, { message: 'Names must be at least 3 characters long' })
  .max(20, { message: 'Names must be at most 20 characters long' })
  .regex(/^[a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*$/, {
    message:
      'Names must start with a letter or number and can contain alphanumeric characters, periods, underscores, or hyphens',
  });
