// SPDX-License-Identifier: FSL-1.1-MIT
import type { PortfolioSnapshot } from '#/modules/balances/domain/entities/portfolio-snapshot.entity';
import type { WalletPortfolioIdentity } from '#/modules/balances/domain/entities/wallet-portfolio-identity.entity';

export const IPortfolioSnapshotRepository = Symbol(
  'IPortfolioSnapshotRepository',
);

export interface IPortfolioSnapshotRepository {
  /**
   * Gets the wallet's cached portfolio snapshot, fetching it from Zerion on a
   * cache miss. Shares its cache entry with the `/v2/safes` overview.
   *
   * @param args - The wallet, environment, currency and token filter
   * @returns {Promise<PortfolioSnapshot>} The validated snapshot
   */
  getSnapshot(args: WalletPortfolioIdentity): Promise<PortfolioSnapshot>;
}
