// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';

/** A requested Safe whose chain resolved and whose address is a Safe on it. */
export type ResolvedSafe = {
  chain: Chain;
  address: Address;
};

/** A resolved Safe with the currency and token filter it is valued in. */
export type PortfolioSummaryRequest = ResolvedSafe & {
  currency: string;
  trusted: boolean;
};
