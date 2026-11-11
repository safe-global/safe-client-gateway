// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import { z } from 'zod';
import { PortfolioSchema } from '#/modules/portfolio/domain/entities/portfolio.entity';

/** The cached portfolio, with its fetch and expiry times in epoch milliseconds. */
export const PortfolioSnapshotSchema = PortfolioSchema.extend({
  fetchedAt: z.number(),
  expiresAt: z.number(),
});

export type PortfolioSnapshot = z.infer<typeof PortfolioSnapshotSchema>;

export type PortfolioSnapshotArgs = {
  address: Address;
  fiatCode: string;
  trusted: boolean;
  isTestnet: boolean;
};
