// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';

/**
 * Most distinct chain IDs one portfolio request may ask for. Above the number
 * of chains we serve, so no real client hits it; it bounds the per-chain Safe
 * checks one request can trigger.
 */
export const MAX_PORTFOLIO_CHAIN_IDS = 50;

/**
 * Comma-separated chain IDs, at least one, duplicates removed. Required: the
 * portfolio route checks the address is a Safe on each chain before any
 * Zerion call, so the list is capped and deduplicated to bound those checks.
 */
export const ChainIdsSchema = z
  .string()
  .transform((val) => [
    ...new Set(
      val
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  ])
  .pipe(z.array(ChainIdSchema).min(1).max(MAX_PORTFOLIO_CHAIN_IDS));

export type ChainIds = z.infer<typeof ChainIdsSchema>;
