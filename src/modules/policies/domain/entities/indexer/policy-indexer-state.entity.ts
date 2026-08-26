// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

/**
 * `chainId` is an `Int` in the indexer and a decimal string everywhere in CGW.
 * Converted to a string here, then validated by the same `ChainIdSchema`.
 */
export const PolicyIndexerChainIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform(String)
  .pipe(ChainIdSchema);

/**
 * The indexer's `numeric` columns serialise as decimal **strings**, not numbers.
 *
 * Token amounts routinely exceed `Number.MAX_SAFE_INTEGER`, so they stay
 * strings all the way to the wire.
 */
export const PolicyIndexerBaseUnitsSchema = z
  .string()
  .regex(/^\d+$/, { error: 'Expected a decimal string of base units' });

/**
 * A `numeric` column that is safe to hold as a number: unix seconds, minutes
 * and counters. Rejected rather than truncated if it does not fit, so the
 * assumption fails loudly if the indexer ever widens one of these.
 */
export const PolicyIndexerIntegerSchema =
  PolicyIndexerBaseUnitsSchema.transform(Number).refine(Number.isSafeInteger, {
    error: 'Expected an integer within the safe range',
  });

/**
 * Whether the window boundary was recovered from the configuring call.
 *
 * `UNKNOWN` means it was not, so `lastResetMin` may be up to one period out.
 * A never-resetting allowance is `EXACT`: there is no boundary to be wrong
 * about.
 */
export const PolicyIndexerAllowanceResetPhaseSchema = z
  .enum(['EXACT', 'UNKNOWN'])
  .catch('UNKNOWN');

export type PolicyIndexerAllowanceResetPhase = z.infer<
  typeof PolicyIndexerAllowanceResetPhaseSchema
>;

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

/**
 * `policykind` and `policyoperation` are exposed as **custom scalars, not
 * GraphQL enums** - introspection reports `SCALAR` with no `enumValues`, so a
 * new indexer release can add a value with no schema signal. CGW therefore
 * validates the value sets itself.
 */
export const PolicyIndexerPolicyKindSchema = z
  .enum([
    'ERC20_TRANSFER',
    'ERC20_APPROVE',
    'ALLOWED_MODULE',
    'COSIGNER',
    'ALLOW',
    'DENY',
    'MULTISEND',
    'NATIVE_TRANSFER',
    'NONE',
    'UNKNOWN',
  ])
  .catch('UNKNOWN');

export type PolicyIndexerPolicyKind = z.infer<
  typeof PolicyIndexerPolicyKindSchema
>;

/**
 * No fallback: an operation CGW cannot place is not a policy it can report, so
 * the row is dropped by the caller instead of being mis-attributed to `CALL`.
 */
export const PolicyIndexerPolicyOperationSchema = z.enum([
  'CALL',
  'DELEGATECALL',
]);

export type PolicyIndexerPolicyOperation = z.infer<
  typeof PolicyIndexerPolicyOperationSchema
>;

/**
 * One `SafePolicyGuard` binding, aggregated by the indexer per
 * `(guard, safe, target, selector, operation)`.
 *
 * `state` is the *accumulated* configuration, already folded from the payload
 * deltas of every `PolicyConfirmed` for the access - which is why CGW no longer
 * replays events. Its shape is decided by `kind`, so it is carried as `unknown`
 * here and parsed by the assembler that owns the kind.
 */
export const PolicyIndexerSafePolicySchema = z.object({
  chainId: PolicyIndexerChainIdSchema,
  safe: AddressSchema,
  guard: AddressSchema,
  target: AddressSchema,
  /** Trimmed to four bytes by the indexer; the event carries 32. */
  selector: HexSchema,
  operation: PolicyIndexerPolicyOperationSchema,
  kind: PolicyIndexerPolicyKindSchema,
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

export type PolicyIndexerSafePolicy = z.infer<
  typeof PolicyIndexerSafePolicySchema
>;


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
  SafePolicy: z.array(z.unknown()),
});

export type PolicyIndexerResponse = z.infer<typeof PolicyIndexerResponseSchema>;

/**
 * The validated read: current policy state for the requested Safes.
 */
export type PolicyIndexerState = {
  meta: Array<PolicyIndexerMeta>;
  allowances: Array<PolicyIndexerSafeAllowance>;
  delegates: Array<PolicyIndexerSafeDelegate>;
  policies: Array<PolicyIndexerSafePolicy>;
};
