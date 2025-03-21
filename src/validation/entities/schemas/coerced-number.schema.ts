import { z } from 'zod';

/**
 * TODO: After Transaction Service is released, use z.coerce.number instead
 *
 * Several numeric values were changed to strings, breaking validation:
 * @see https://github.com/safe-global/safe-transaction-service/pull/2367
 * @see https://github.com/safe-global/safe-transaction-service/pull/2402
 */
export const CoercedNumberSchema = z
  .union([z.number(), z.string()])
  .pipe(z.coerce.number());
