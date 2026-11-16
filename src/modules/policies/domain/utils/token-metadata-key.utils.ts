// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

export type TokenMetadataKey = `${string}:${Address}`;

export function tokenMetadataKey(args: {
  chainId: string;
  address: Address;
}): TokenMetadataKey {
  return `${args.chainId}:${args.address}`;
}
