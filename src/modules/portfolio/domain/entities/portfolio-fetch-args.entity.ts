// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';

/** What one portfolio fetch needs: the Safe address, currency, environment and the cache entry to fill. */
export type PortfolioFetchArgs = {
  address: Address;
  fiatCode: string;
  isTestnet?: boolean;
  sync?: boolean;
  cacheDir: CacheDir;
};
