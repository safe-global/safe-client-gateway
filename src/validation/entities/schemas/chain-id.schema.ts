// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * Validates a base-10 chain ID: a positive integer with no leading zeros.
 * Coerces numeric input (e.g. `1`) to its string form.
 */
export const ChainIdSchema = z.coerce.string().regex(/^[1-9]\d*$/, {
  error: 'Invalid chain ID',
});
