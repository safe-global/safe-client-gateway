// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export type AllowanceRead = z.infer<typeof AllowanceReadSchema>;

/** One `allowance` call of a multicall: its result, or a failure. */
export const AllowanceReadSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success'), result: z.bigint() }),
  z.object({ status: z.literal('failure') }),
]);
