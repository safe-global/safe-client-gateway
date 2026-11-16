// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

/** The address of a Safe on one chain. */
export type ChainSafeAddress = {
  chainId: string;
  safeAddress: Address;
};
