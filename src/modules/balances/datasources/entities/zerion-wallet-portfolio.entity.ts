// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Schema for the Zerion wallet portfolio endpoint response.
 * Reference: https://api.zerion.io/v1/wallets/{address}/portfolio
 */

import { z } from 'zod';

export const ZerionWalletPortfolioTotalSchema = z.object({
  positions: z.number(),
});

// Zerion returns null when it has no price history for the wallet yet.
export const ZerionWalletPortfolioChangesSchema = z.object({
  absolute_1d: z.number().nullable(),
  percent_1d: z.number().nullable(),
});

export const ZerionWalletPortfolioAttributesSchema = z.object({
  total: ZerionWalletPortfolioTotalSchema,
  // Not used by /v2/safes, so a missing or malformed value is dropped rather
  // than failing the parse. Entries cached before they were kept lack them.
  changes: ZerionWalletPortfolioChangesSchema.nullish().catch(undefined),
  positions_distribution_by_type: z
    .record(z.string(), z.number())
    .optional()
    .catch(undefined),
  // Keys are Zerion network names; lower-cased to match the chain-list mapping.
  positions_distribution_by_chain: z
    .record(z.string(), z.number())
    .transform((byChain) =>
      Object.fromEntries(
        Object.entries(byChain).map(([network, value]) => [
          network.toLowerCase(),
          value,
        ]),
      ),
    ),
});

export type ZerionWalletPortfolioAttributes = z.infer<
  typeof ZerionWalletPortfolioAttributesSchema
>;

export const ZerionWalletPortfolioDataSchema = z.object({
  type: z.literal('portfolio'),
  id: z.string(),
  attributes: ZerionWalletPortfolioAttributesSchema,
});

export const ZerionWalletPortfolioSchema = z.object({
  data: ZerionWalletPortfolioDataSchema,
});

export type ZerionWalletPortfolio = z.infer<typeof ZerionWalletPortfolioSchema>;

/**
 * A cached portfolio together with when it was fetched and when its cache
 * entry expires, both as epoch milliseconds. The timestamps describe the
 * stored entry, so every read of it reports the same values.
 */
export const ZerionWalletPortfolioSnapshotSchema =
  ZerionWalletPortfolioSchema.extend({
    fetchedAt: z.number(),
    expiresAt: z.number(),
  });

export type ZerionWalletPortfolioSnapshot = z.infer<
  typeof ZerionWalletPortfolioSnapshotSchema
>;
