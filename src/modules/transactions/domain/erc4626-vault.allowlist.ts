// SPDX-License-Identifier: FSL-1.1-MIT
import { type Address, isAddressEqual } from 'viem';
import {
  type Erc4626Vault,
  Erc4626VaultSchema,
} from '#/modules/transactions/domain/entities/erc4626-vault.entity';

// SPIKE: a typed constant stands in for a config-sourced list (Config Service
// or a per-chain config value) so the generic decoding path can be proven.
// Asset and decimals live here rather than being read on-chain: they are
// immutable for a vault and the entry is already the trust anchor.
export const ALLOWLISTED_ERC4626_VAULTS: ReadonlyArray<Erc4626Vault> =
  Erc4626VaultSchema.array().parse([
    {
      chainId: '1',
      address: '0xe2e7a17dFf93280dec073C995595155283e3C372',
      name: 'Spark Savings USDT',
      protocol: 'Spark',
      asset: {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
        symbol: 'USDT',
      },
    },
  ]);

export function findAllowlistedErc4626Vault(args: {
  chainId: string;
  address: Address;
}): Erc4626Vault | null {
  return (
    ALLOWLISTED_ERC4626_VAULTS.find((vault) => {
      return (
        vault.chainId === args.chainId &&
        isAddressEqual(vault.address, args.address)
      );
    }) ?? null
  );
}
