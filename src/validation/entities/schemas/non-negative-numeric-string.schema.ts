// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * Validates a base-10 integer string that is non-negative (>= 0), in canonical
 * form (no leading zeros, e.g. "0" or "42", not "007").
 *
 * Mirrors the fee service's `IsNonNegativeBigInt` validation so that invalid
 * values (hex, decimals, negatives, non-numeric) are rejected by the gateway
 * with a consistent 422 before the request reaches the fee service.
 */
export const NonNegativeNumericStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, { error: 'Invalid non-negative integer string' });
