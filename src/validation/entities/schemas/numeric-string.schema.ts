import { z } from 'zod';

function isNumeric(value: unknown): boolean {
  return typeof value === 'string' && !isNaN(Number(value));
}

export const NumericStringSchema = z.string().refine(isNumeric);
