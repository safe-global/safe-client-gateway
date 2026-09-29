// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

/**
 * A `chainId:address` composite, lowercased so map lookups are
 * case-insensitive regardless of how the address was checksummed.
 */
export type TokenMetadataKey = `${string}:${string}`;

/**
 * The key a token's metadata is stored and looked up under, scoped to the
 * chain it lives on - the same address means a different token on another
 * chain.
 */
export function tokenMetadataKey(args: {
  chainId: string;
  address: Address;
}): TokenMetadataKey {
  return `${args.chainId}:${args.address.toLowerCase()}`;
}
