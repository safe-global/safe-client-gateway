// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import { ZerionWalletPortfolioSnapshotSchema } from '#/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';

/**
 * A wallet's portfolio across every chain of one environment, as one cached
 * Zerion snapshot. Fiat values are in the requested currency.
 */
export const PortfolioSnapshotSchema =
  ZerionWalletPortfolioSnapshotSchema.transform(
    ({ data: { attributes }, fetchedAt, expiresAt }) => ({
      fiatTotal: attributes.total.positions,
      fiatChange1d: attributes.changes?.absolute_1d ?? null,
      percentChange1d: attributes.changes?.percent_1d ?? null,
      // Keyed by lower-cased Zerion network name.
      fiatTotalByNetwork: attributes.positions_distribution_by_chain,
      fiatTotalByType: attributes.positions_distribution_by_type ?? {},
      updatedAt: new Date(fetchedAt),
      expiresAt: new Date(expiresAt),
    }),
  );

export type PortfolioSnapshot = z.infer<typeof PortfolioSnapshotSchema>;
