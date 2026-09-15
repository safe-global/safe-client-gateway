// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import {
  PolicyIndexerAllowanceResetPhaseSchema,
  PolicyIndexerBaseUnitsSchema,
  PolicyIndexerChainIdSchema,
  PolicyIndexerIntegerSchema,
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
 *
 * The indexer no longer mirrors the delegate's registration onto this row, so
 * `isDelegateActive` is absent here and folded in by the repository - see
 * {@link PolicyIndexerSafeAllowance}.
 */
export const PolicyIndexerSafeAllowanceSchema = z.object({
  chainId: PolicyIndexerChainIdSchema,
  safe: AddressSchema,
  module: AddressSchema,
  moduleVersion: z.string(),
  delegate: AddressSchema,
  token: AddressSchema,
  /** Per-window ceiling. `0` means deleted, or never set. */
  amount: PolicyIndexerBaseUnitsSchema,
  /** Spent in the window beginning at `lastResetMin`. */
  spent: PolicyIndexerBaseUnitsSchema,
  /** `max(0, amount - spent)`, already clamped by the indexer. */
  remaining: PolicyIndexerBaseUnitsSchema,
  /**
   * Window length in **minutes**, matching the contract's unit. `0` never
   * resets, and is a real value rather than absence - it is the majority of
   * configured allowances on some deployments.
   */
  resetTimeMinutes: PolicyIndexerIntegerSchema,
  /**
   * Start of the current window, in **minutes since the epoch** - the contract's
   * own unit, not unix seconds. The indexer no longer serves the next boundary,
   * so a caller derives it as `(lastResetMin + resetTimeMinutes) * 60`, and only
   * when `resetTimeMinutes` is non-zero.
   */
  lastResetMin: PolicyIndexerIntegerSchema,
  resetPhase: PolicyIndexerAllowanceResetPhaseSchema,
  nonce: PolicyIndexerBaseUnitsSchema,
  /** Unix seconds of the last event that moved this row. */
  updatedAt: PolicyIndexerIntegerSchema,
});

/** One allowance exactly as the indexer serves it. */
export type PolicyIndexerSafeAllowanceRow = z.infer<
  typeof PolicyIndexerSafeAllowanceSchema
>;

/**
 * An allowance with the delegate's registration folded in.
 *
 * `isDelegateActive` is CGW's, not the indexer's: the repository reads it from
 * the `SafeDelegate` of the same `(chainId, safe, module, delegate)` in the same
 * response. An allowance outlives its delegate - `RemoveDelegate` unlinks a list
 * node and leaves the limit behind - so `false` means unspendable now, never
 * gone, and the limit returns to effect if the delegate is re-added.
 *
 * A row with no registration at all is `false` for the same reason: no
 * registration is a removed delegate, not a missing one.
 */
export type PolicyIndexerSafeAllowance = PolicyIndexerSafeAllowanceRow & {
  isDelegateActive: boolean;
};

/**
 * A delegate registration of the `AllowanceModule`, per
 * `(module, safe, delegate)`.
 *
 * `active` cycles: it means "cannot spend now", never "has no allowance".
 */
export const PolicyIndexerSafeDelegateSchema = z.object({
  chainId: PolicyIndexerChainIdSchema,
  safe: AddressSchema,
  module: AddressSchema,
  moduleVersion: z.string(),
  delegate: AddressSchema,
  active: z.boolean(),
  /** First registration; never moves. */
  addedAt: PolicyIndexerIntegerSchema,
  updatedAt: PolicyIndexerIntegerSchema,
});

export type PolicyIndexerSafeDelegate = z.infer<
  typeof PolicyIndexerSafeDelegateSchema
>;
