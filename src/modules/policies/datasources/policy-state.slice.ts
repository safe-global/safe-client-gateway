// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

/**
 * One Safe's share of an indexer response - the unit that is cached.
 *
 * Field names are the indexer's root fields, so a slice is the same shape as the
 * response it was cut from and merging slices reconstructs one.
 */
export const PolicyStateSliceSchema = z.object({
  _meta: z.array(z.unknown()),
  SafeAllowance: z.array(z.unknown()),
  SafeDelegate: z.array(z.unknown()),
});

export type PolicyStateSlice = z.infer<typeof PolicyStateSliceSchema>;

/**
 * Enough of a row to place it: which chain, and which Safe.
 *
 * Parsed rather than asserted, because the datasource has not validated the rows
 * at this point - that is the repository's job. `_meta` carries no `safe`, so its
 * rows are placed by chain alone.
 */
const RowLocationSchema = z.object({
  chainId: z.number().int(),
  safe: z.string().optional(),
});

const ROW_FIELDS = [
  'SafeAllowance',
  'SafeDelegate',
] as const satisfies ReadonlyArray<keyof PolicyStateSlice>;

/**
 * The rows of {@link response} belonging to {@link safe}.
 *
 * `_meta` is per chain rather than per Safe, so the chain's entry travels with
 * every Safe on it: the indexing progress a caller reads is then always the one
 * that produced the rows beside it, even when they came from different requests.
 */
export function sliceForSafe(
  response: PolicyStateSlice,
  safe: SafeRef,
): PolicyStateSlice {
  const belongsToChain = (row: unknown): boolean => {
    const location = RowLocationSchema.safeParse(row);
    return location.success && String(location.data.chainId) === safe.chainId;
  };
  const belongsToSafe = (row: unknown): boolean => {
    const location = RowLocationSchema.safeParse(row);
    return (
      location.success &&
      String(location.data.chainId) === safe.chainId &&
      location.data.safe?.toLowerCase() === safe.address.toLowerCase()
    );
  };

  const slice: PolicyStateSlice = {
    _meta: response._meta.filter(belongsToChain),
    SafeAllowance: [],
    SafeDelegate: [],
  };

  for (const field of ROW_FIELDS) {
    slice[field] = response[field].filter(belongsToSafe);
  }

  return slice;
}

/**
 * Reassembles slices into one response.
 *
 * `_meta` is deduplicated by chain, since every slice of a chain carries it.
 */
export function mergeSlices(
  slices: ReadonlyArray<PolicyStateSlice>,
): PolicyStateSlice {
  const merged: PolicyStateSlice = {
    _meta: [],
    SafeAllowance: [],
    SafeDelegate: [],
  };
  const chains = new Set<number>();

  for (const slice of slices) {
    for (const meta of slice._meta) {
      const location = RowLocationSchema.safeParse(meta);
      if (location.success && !chains.has(location.data.chainId)) {
        chains.add(location.data.chainId);
        merged._meta.push(meta);
      }
    }
    for (const field of ROW_FIELDS) {
      merged[field].push(...slice[field]);
    }
  }

  return merged;
}
