// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import {
  IndexerChainIdSchema,
  IndexerPolicyKindSchema,
  IndexerPolicyOperationSchema,
} from '@/modules/policies/domain/entities/indexer/indexer-scalars.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

/**
 * One `SafePolicyGuard` binding, aggregated by the indexer per
 * `(guard, safe, target, selector, operation)`.
 *
 * `state` is the *accumulated* configuration, already folded from the payload
 * deltas of every `PolicyConfirmed` for the access - which is why CGW no longer
 * replays events. Its shape is decided by `kind`, so it is carried as `unknown`
 * here and parsed by the assembler that owns the kind.
 */
export const IndexerSafePolicySchema = z.object({
  chainId: IndexerChainIdSchema,
  safe: AddressSchema,
  guard: AddressSchema,
  target: AddressSchema,
  /** Trimmed to four bytes by the indexer; the event carries 32. */
  selector: HexSchema,
  operation: IndexerPolicyOperationSchema,
  kind: IndexerPolicyKindSchema,
  policy: AddressSchema,
  /**
   * `false` once unbound. The binding keeps its `policy`, `kind` and `state`,
   * because the policy contract's own storage is untouched by an unbind and the
   * retained configuration returns to effect if the access is rebound.
   */
  active: z.boolean(),
  /** `target` and `selector` both zeroed - the catch-all binding. */
  isFallback: z.boolean(),
  state: z.unknown(),
});

export type IndexerSafePolicy = z.infer<typeof IndexerSafePolicySchema>;
