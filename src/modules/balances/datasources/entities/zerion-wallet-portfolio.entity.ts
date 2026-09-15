/**
 * Schema for the Zerion wallet portfolio endpoint response.
 * Reference: https://api.zerion.io/v1/wallets/{address}/portfolio
 */

import { z } from 'zod';

export const ZerionWalletPortfolioTotalSchema = z.object({
  positions: z.number(),
});

export const ZerionWalletPortfolioAttributesSchema = z.object({
  total: ZerionWalletPortfolioTotalSchema,
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

export const ZerionWalletPortfolioDataSchema = z.object({
  type: z.literal('portfolio'),
  id: z.string(),
  attributes: ZerionWalletPortfolioAttributesSchema,
});

export const ZerionWalletPortfolioSchema = z.object({
  data: ZerionWalletPortfolioDataSchema,
});

export type ZerionWalletPortfolio = z.infer<typeof ZerionWalletPortfolioSchema>;
