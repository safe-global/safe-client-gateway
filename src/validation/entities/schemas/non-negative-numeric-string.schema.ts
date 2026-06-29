// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * Validates a base-10 integer string that is non-negative (>= 0).
 *
 * Mirrors the fee service's `IsNonNegativeBigInt` validation so that invalid
 * values (hex, decimals, negatives, non-numeric) are rejected by the gateway
 * with a consistent 422 before the request reaches the fee service.
 */
function isNonNegativeIntegerString(value: unknown): boolean {
  return typeof value === 'string' && /^\d+$/.test(value);
}

export const NonNegativeNumericStringSchema = z
  .string()
  .refine(isNonNegativeIntegerString, {
    error: 'Invalid non-negative integer string',
  });
