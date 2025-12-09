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
