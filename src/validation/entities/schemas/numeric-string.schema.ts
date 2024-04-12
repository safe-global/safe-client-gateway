import { z } from 'zod';

function isNumeric(value: unknown): boolean {
  return typeof value === 'string' && !isNaN(Number(value));
}

export const NumericStringSchema = z.string().refine(isNumeric, {
  message: 'Invalid base-10 numeric string',
});
