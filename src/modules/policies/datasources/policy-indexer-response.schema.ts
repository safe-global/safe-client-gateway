// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import {
  type PolicyIndexerRows,
  PolicyIndexerRowsSchema,
} from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';

/**
 * A GraphQL response envelope. Transport-level, so it is parsed in the
 * datasource rather than modelled as a domain entity: `data` stays opaque for
 * the repository to parse.
 */
export const PolicyIndexerResponseSchema = z.object({
  data: PolicyIndexerRowsSchema.optional(),
  errors: z
    .array(z.object({ message: z.string().optional() }))
    .nonempty()
    .optional(),
});

export type PolicyIndexerResponse = z.infer<typeof PolicyIndexerResponseSchema>;

/**
 * Enough of a row to place it: which chain, and which Safe.
 *
 * Parsed rather than asserted, because the datasource has not validated the rows
 * at this point - that is the repository's job. `_meta` carries no `safe`, so its
 * rows are placed by chain alone.
 */
export const RowLocationSchema = z.object({
  chainId: z.number().int(),
  safe: z.string().optional(),
});

export const ROW_FIELDS = [
  'SafeAllowance',
  'SafeDelegate',
] as const satisfies ReadonlyArray<keyof PolicyIndexerRows>;
