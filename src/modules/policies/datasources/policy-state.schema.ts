// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * Polices on a Safe.
 */
export const PoliciesStateSchema = z.object({
  _meta: z.array(z.unknown()),
  SafeAllowance: z.array(z.unknown()),
  SafeDelegate: z.array(z.unknown()),
});

export type PoliciesState = z.infer<typeof PoliciesStateSchema>;

/**
 * Enough of a row to place it: which chain, and which Safe.
 *
 * Parsed rather than asserted, because the datasource has not validated the rows
 * at this point - that is the repository's job. `_meta` carries no `safe`, so its
 * rows are placed by chain alone.
 *
 * Exported because `PolicyIndexerApi` needs the same lookup to cut a fetched
 * response down to one Safe's rows before caching it - the shape of a row is
 * defined once, here, for both places that place one.
 */
export const RowLocationSchema = z.object({
  chainId: z.number().int(),
  safe: z.string().optional(),
});

export const ROW_FIELDS = [
  'SafeAllowance',
  'SafeDelegate',
] as const satisfies ReadonlyArray<keyof PoliciesState>;
