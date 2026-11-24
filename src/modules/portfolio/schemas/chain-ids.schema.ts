// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';

/**
 * Comma-separated chain IDs, at least one. Required: the portfolio route
 * checks the address is a Safe on each chain before any Zerion call.
 */
export const ChainIdsSchema = z
  .string()
  .transform((val) =>
    val
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
  .pipe(z.array(ChainIdSchema).min(1));

export type ChainIds = z.infer<typeof ChainIdsSchema>;
