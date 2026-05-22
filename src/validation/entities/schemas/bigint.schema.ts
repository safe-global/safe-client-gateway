// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

// Zod does not support bigint natively, so we use string and transform
export const BigIntSchema = z.string().transform((val, ctx) => {
  try {
    return BigInt(val);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid bigint string' });
    return z.NEVER;
  }
});
