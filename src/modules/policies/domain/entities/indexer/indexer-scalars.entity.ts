// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from "zod";
import { ChainIdSchema } from "@/modules/chains/domain/entities/schemas/chain-id.schema";

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
  .regex(/^\d+$/, { error: "Expected a decimal string of base units" });

/**
 * A `numeric` column that is safe to hold as a number: unix seconds, minutes
 * and counters. Rejected rather than truncated if it does not fit, so the
 * assumption fails loudly if the indexer ever widens one of these.
 */
export const PolicyIndexerIntegerSchema =
  PolicyIndexerBaseUnitsSchema.transform(Number).refine(Number.isSafeInteger, {
    error: "Expected an integer within the safe range",
  });

/**
 * Whether the window boundary was recovered from the configuring call.
 *
 * `UNKNOWN` means it was not, so `lastResetMin` may be up to one period out.
 * A never-resetting allowance is `EXACT`: there is no boundary to be wrong
 * about.
 */
export const PolicyIndexerAllowanceResetPhaseSchema = z
  .enum(["EXACT", "UNKNOWN"])
  .catch("UNKNOWN");

export type PolicyIndexerAllowanceResetPhase = z.infer<
  typeof PolicyIndexerAllowanceResetPhaseSchema
>;
