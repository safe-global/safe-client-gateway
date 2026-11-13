// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

/**
 * Identifies a Safe on one chain, regardless of the address's checksum casing.
 */
export function getChainSafeKey(chainId: string, safeAddress: Address): string {
  return `${chainId}:${safeAddress.toLowerCase()}`;
}
