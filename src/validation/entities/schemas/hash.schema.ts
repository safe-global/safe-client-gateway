// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';
import { isHash } from 'viem';
import { z } from 'zod';

// Lower-cased so one hash cannot reach an upstream URL or a cache field in two
// spellings.
export const HashSchema = z
  .string()
  .refine(isHash, { error: 'Invalid hash' })
  .transform((hash) => hash.toLowerCase() as Hex);
