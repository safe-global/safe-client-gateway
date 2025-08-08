import { z } from 'zod';

export const DateStringSchema = z
  .string()
  .refine((val) => !isNaN(new Date(val).getTime()), {
    message: 'Invalid date string',
  });
