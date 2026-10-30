// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';

/** A requested Safe whose chain resolved and whose address is a Safe there. */
export type ResolvedSafe = {
  chain: Chain;
  address: Address;
};

/** Zerion network names by chainId, and the reverse, for one environment. */
export type ZerionNetworks = {
  byChainId: Record<string, string>;
  chainIdByNetwork: Map<string, string>;
};
