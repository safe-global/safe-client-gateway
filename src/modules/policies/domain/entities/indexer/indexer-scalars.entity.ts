// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * Scalars of the Policy Indexer's read contract.
 *
 * Four of its column types need converting rather than accepting as they
 * arrive, and each conversion has a failure mode that is silent if skipped -
 * see the notes on the individual schemas.
 */

/**
 * `chainId` is an `Int` in the indexer and a decimal string everywhere in CGW.
 * Converted here so no repository, service or route ever sees the numeric form.
 */
export const IndexerChainIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform(String);

/**
 * The indexer's `numeric` columns serialise as decimal **strings**, not numbers.
 *
 * Token amounts routinely exceed `Number.MAX_SAFE_INTEGER`, so they stay
 * strings all the way to the wire. Parsing them into a `number` truncates
 * silently: an 18-decimal balance loses its low digits and still looks like a
 * plausible amount.
 */
export const IndexerBaseUnitsSchema = z
  .string()
  .regex(/^\d+$/, { error: 'Expected a decimal string of base units' });

/**
 * A `numeric` column that is safe to hold as a number: unix seconds, minutes
 * and counters. Rejected rather than truncated if it does not fit, so the
 * assumption fails loudly if the indexer ever widens one of these.
 */
export const IndexerIntegerSchema = IndexerBaseUnitsSchema.transform(
  Number,
).refine(Number.isSafeInteger, {
  error: 'Expected an integer within the safe range',
});

/**
 * `resetphase`, `policykind`, `policyoperation` and `rootstatus` are exposed as
 * **custom scalars, not GraphQL enums** - introspection reports `SCALAR` with no
 * `enumValues`, so a new indexer release can add a value with no schema signal.
 * CGW therefore validates the value sets itself.
 *
 * Where a fallback exists it is the pessimistic one: an unrecognised reset phase
 * is treated as `ASSUMED` (boundary not to be trusted) and an unrecognised
 * policy kind as `UNKNOWN` (not rendered), rather than guessing.
 */
export const IndexerResetPhaseSchema = z
  .enum(['NONE', 'EXACT', 'ASSUMED'])
  .catch('ASSUMED');

export type IndexerResetPhase = z.infer<typeof IndexerResetPhaseSchema>;

export const IndexerPolicyKindSchema = z
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

export type IndexerPolicyKind = z.infer<typeof IndexerPolicyKindSchema>;

/**
 * No fallback: an operation CGW cannot place is not a policy it can report, so
 * the row is dropped by the caller instead of being mis-attributed to `CALL`.
 */
export const IndexerPolicyOperationSchema = z.enum(['CALL', 'DELEGATECALL']);

export type IndexerPolicyOperation = z.infer<
  typeof IndexerPolicyOperationSchema
>;

export const IndexerRootStatusSchema = z.enum([
  'PENDING',
  'APPLIED',
  'INVALIDATED',
]);

export type IndexerRootStatus = z.infer<typeof IndexerRootStatusSchema>;
