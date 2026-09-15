// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { PolicyIndexerChainIdSchema } from '@/modules/policies/domain/entities/indexer/indexer-scalars.entity';
import type {
  PolicyIndexerSafeAllowance,
  PolicyIndexerSafeDelegate,
} from '@/modules/policies/domain/entities/indexer/safe-allowance.entity';

/**
 * Indexing progress, one entry per chain - `_meta` is a list, not an object.
 *
 * `isReady` only records that a chain caught up *once*, so it stays `true` while
 * the indexer falls behind. Staleness is `sourceBlock - progressBlock`.
 */
export const PolicyIndexerMetaSchema = z.object({
  chainId: PolicyIndexerChainIdSchema,
  progressBlock: z.number().int(),
  sourceBlock: z.number().int(),
  isReady: z.boolean(),
});

export type PolicyIndexerMeta = z.infer<typeof PolicyIndexerMetaSchema>;

/**
 * The envelope of the indexer's response: array shapes only.
 *
 * Rows are validated one by one by `PolicyIndexerRepository`, which drops and
 * logs the ones it cannot read. A single unreadable row - a policy kind added by
 * a newer indexer release, say - must not blank a Safe's policies.
 */
export const PolicyIndexerResponseSchema = z.object({
  _meta: z.array(z.unknown()),
  SafeAllowance: z.array(z.unknown()),
  SafeDelegate: z.array(z.unknown()),
});

export type PolicyIndexerResponse = z.infer<typeof PolicyIndexerResponseSchema>;

/**
 * The validated read: current policy state for the requested Safes.
 */
export type PolicyIndexerState = {
  meta: Array<PolicyIndexerMeta>;
  allowances: Array<PolicyIndexerSafeAllowance>;
  delegates: Array<PolicyIndexerSafeDelegate>;
};
