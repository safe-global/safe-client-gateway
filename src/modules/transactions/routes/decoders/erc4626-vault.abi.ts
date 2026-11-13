// SPDX-License-Identifier: FSL-1.1-MIT
import { erc4626Abi, type Hex, parseAbi, toFunctionSelector } from 'viem';
import {
  type Erc4626VaultMethod,
  Erc4626VaultMethods,
} from '#/modules/transactions/domain/entities/erc4626-vault.entity';

/**
 * Non-standard ERC-4626 entry points that append a `uint16 referral` code
 * (e.g. Spark Savings vaults). They are not part of EIP-4626, so viem's
 * `erc4626Abi` does not know their selectors.
 */
export const erc4626ReferralAbi = parseAbi([
  'function deposit(uint256 assets, address receiver, uint16 referral) returns (uint256 shares)',
  'function mint(uint256 shares, address receiver, uint16 referral) returns (uint256 assets)',
]);

/** Standard ERC-4626 plus the known non-standard overloads. */
export const erc4626VaultAbi = [...erc4626Abi, ...erc4626ReferralAbi] as const;

function isVaultMethod(name: string): name is Erc4626VaultMethod {
  return Erc4626VaultMethods.some((method) => method === name);
}

function getVaultSelectors(): Record<Erc4626VaultMethod, Array<Hex>> {
  const selectors: Record<Erc4626VaultMethod, Array<Hex>> = {
    deposit: [],
    mint: [],
    withdraw: [],
    redeem: [],
  };
  for (const item of erc4626VaultAbi) {
    if (item.type === 'function' && isVaultMethod(item.name)) {
      selectors[item.name].push(toFunctionSelector(item));
    }
  }
  return selectors;
}

/** Every selector of each vault entry point, overloads included. */
export const ERC4626_VAULT_SELECTORS = getVaultSelectors();
