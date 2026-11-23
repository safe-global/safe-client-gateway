// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { TokenSpenderSchema } from '#/modules/token-approvals/domain/entities/token-approval.entity';

export type TokenApprovalsScanState = z.infer<
  typeof TokenApprovalsScanStateSchema
>;

/** How far the scan of a Safe's `Approval` logs got, kept between requests. */
export const TokenApprovalsScanStateSchema = z.object({
  /** Every token and spender pair found so far. */
  pairs: z.array(TokenSpenderSchema),
  /** Every block from 0 up to this one is scanned; `null` before the first. */
  lastScannedBlock: z.number().int().nonnegative().nullable(),
  /** The block range of the last `eth_getLogs` call that worked; `null` before the first. */
  rangeSize: z.number().int().positive().nullable(),
  /** Whether a pair was left out because the list was full. */
  hasDroppedPairs: z.boolean(),
});
