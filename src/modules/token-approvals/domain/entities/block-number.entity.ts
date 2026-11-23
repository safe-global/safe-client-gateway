// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const BlockNumberSchema = z
  .bigint()
  .nonnegative()
  .transform(Number)
  .refine(Number.isSafeInteger, {
    error: 'Expected a block number within the safe integer range',
  });
