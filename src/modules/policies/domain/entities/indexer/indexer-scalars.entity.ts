// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';

/**
 * Scalars of the Policy Indexer's read contract.
 *
 * Several of its column types need converting rather than accepting as they
 * arrive, and each conversion has a failure mode that is silent if skipped -
 * see the notes on the individual schemas.
 */

/**
 * `chainId` is an `Int` in the indexer and a decimal string everywhere in CGW.
 * Converted to a string here, then validated by the same `ChainIdSchema` every
 * other chain id in CGW goes through, so no repository, service or route ever
 * sees the numeric form or a chain id this schema wouldn't otherwise accept.
 */
export const IndexerChainIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform(String)
  .pipe(ChainIdSchema);

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
 * `resetphase` is exposed as a **custom scalar, not a GraphQL enum** -
 * introspection reports `SCALAR` with no `enumValues`, so a new indexer
 * release can add a value with no schema signal. CGW therefore validates the
 * value set itself.
 *
 * `policykind`, `policyoperation` and `rootstatus` are the indexer's other
 * custom scalars, exposed the same way - but they describe guard-enforced
 * policies and pending configuration requests, neither of which this branch
 * reads, so their schemas are not here.
 *
 * Where a fallback exists it is the pessimistic one: an unrecognised reset
 * phase becomes `UNKNOWN` - a boundary not to be trusted - rather than a
 * guess.
 */

/**
 * Whether the window boundary was recovered from the configuring call.
 *
 * `UNKNOWN` means it was not, so `lastResetMin` may be up to one period out.
 * A never-resetting allowance is `EXACT`: there is no boundary to be wrong
 * about.
 */
export const IndexerAllowanceResetPhaseSchema = z
  .enum(['EXACT', 'UNKNOWN'])
  .catch('UNKNOWN');

export type IndexerAllowanceResetPhase = z.infer<
  typeof IndexerAllowanceResetPhaseSchema
>;
