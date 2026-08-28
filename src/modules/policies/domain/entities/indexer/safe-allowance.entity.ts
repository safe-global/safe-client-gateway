// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import {
  IndexerBaseUnitsSchema,
  IndexerChainIdSchema,
  IndexerIntegerSchema,
  IndexerResetPhaseSchema,
} from '@/modules/policies/domain/entities/indexer/indexer-scalars.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * One allowance of the `AllowanceModule`, aggregated by the indexer per
 * `(module, safe, delegate, token)`.
 *
 * The module is not a same-address singleton and a chain can run more than one
 * version at once with independent storage, so `module` is part of the grain:
 * two versions holding limits for one Safe are two real allowances and are never
 * merged.
 *
 * `token` is the zero address for the native currency.
 */
export const IndexerSafeAllowanceSchema = z.object({
  chainId: IndexerChainIdSchema,
  safe: AddressSchema,
  module: AddressSchema,
  moduleVersion: z.string(),
  delegate: AddressSchema,
  token: AddressSchema,
  /**
   * Mirrors the delegate's registration. `false` means nothing is spendable
   * *now* - `RemoveDelegate` deletes a linked-list node only, so the allowance
   * survives and returns to effect if the delegate is re-added.
   */
  delegateActive: z.boolean(),
  /** Per-window ceiling. `0` means deleted, or never set. */
  amount: IndexerBaseUnitsSchema,
  /** Spent in the window beginning at `lastResetAt`. */
  spent: IndexerBaseUnitsSchema,
  /** `max(0, amount - spent)`, already clamped by the indexer. */
  remaining: IndexerBaseUnitsSchema,
  /**
   * Window length in **minutes**, matching the contract's unit. `0` never
   * resets, and is a real value rather than absence - it is the majority of
   * configured allowances on some deployments.
   */
  resetTimeMinutes: IndexerIntegerSchema,
  lastResetAt: IndexerIntegerSchema,
  /** `0` when the allowance never resets. */
  nextResetAt: IndexerIntegerSchema,
  resetPhase: IndexerResetPhaseSchema,
  nonce: IndexerBaseUnitsSchema,
});

export type IndexerSafeAllowance = z.infer<typeof IndexerSafeAllowanceSchema>;

/**
 * A delegate registration of the `AllowanceModule`, per
 * `(module, safe, delegate)`.
 *
 * `active` cycles: it means "cannot spend now", never "has no allowance".
 */
export const IndexerSafeDelegateSchema = z.object({
  chainId: IndexerChainIdSchema,
  safe: AddressSchema,
  module: AddressSchema,
  moduleVersion: z.string(),
  delegate: AddressSchema,
  active: z.boolean(),
  /** First registration; never moves. */
  addedAt: IndexerIntegerSchema,
  updatedAt: IndexerIntegerSchema,
});

export type IndexerSafeDelegate = z.infer<typeof IndexerSafeDelegateSchema>;
