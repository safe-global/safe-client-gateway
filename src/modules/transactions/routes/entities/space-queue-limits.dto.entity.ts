// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import {
  SAFE_QUEUE_SERVICE_MAX_LIMIT,
  SAFE_QUEUE_SERVICE_MAX_SAFES,
} from '#/domain/common/constants';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';

// One below the queue service's maximum page, which holds one lookahead transaction more
export const SPACE_QUEUE_MAX_SAFE_LIMIT = SAFE_QUEUE_SERVICE_MAX_LIMIT - 1;

const SafeQueueLimitSchema = z
  .string()
  .transform((entry) => {
    const [safeAddress = '', limit = ''] = entry.split(':');
    return { safeAddress, limit: Number(limit) };
  })
  .pipe(
    z.object({
      safeAddress: AddressSchema,
      limit: z.number().int().min(1).max(SPACE_QUEUE_MAX_SAFE_LIMIT),
    }),
  );

/**
 * `limits` query of the Space queue: comma-separated `address:count` pairs,
 * the number of pending transactions to return for each listed Safe.
 */
export const SpaceQueueLimitsSchema = z
  .string()
  .optional()
  .transform((value) => (value ? value.split(',') : []))
  .pipe(z.array(SafeQueueLimitSchema).max(SAFE_QUEUE_SERVICE_MAX_SAFES))
  .refine(
    (limits) =>
      new Set(limits.map(({ safeAddress }) => safeAddress)).size ===
      limits.length,
    { message: 'Each Safe can only be listed once' },
  );

export type SpaceQueueLimits = z.infer<typeof SpaceQueueLimitsSchema>;
