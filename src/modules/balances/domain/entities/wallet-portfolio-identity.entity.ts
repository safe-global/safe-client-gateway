// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

/**
 * Everything that changes a wallet's portfolio snapshot, and so its cache
 * entry: the address, the environment, the currency and the token filter.
 */
export type WalletPortfolioIdentity = {
  address: Address;
  currency: string;
  isTestnet: boolean;
  trusted: boolean;
};
