// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { HexSchema } from '#/validation/entities/schemas/hex.schema';
import { NonNegativeNumericStringSchema } from '#/validation/entities/schemas/non-negative-numeric-string.schema';

export const Erc4626VaultMethods = [
  'deposit',
  'mint',
  'withdraw',
  'redeem',
] as const;

export type Erc4626VaultMethod = (typeof Erc4626VaultMethods)[number];

const Erc4626VaultCallBaseSchema = z.object({
  to: AddressSchema.optional(),
  data: HexSchema,
  value: z.string(),
  receiver: AddressSchema,
});

/**
 * A decoded ERC-4626 entry point. Amounts stay `bigint` (uint256), and each
 * method only carries the amount its calldata has: `redeem`/`mint` take
 * shares, `deposit`/`withdraw` take assets.
 */
export const Erc4626VaultCallSchema = z.discriminatedUnion('method', [
  Erc4626VaultCallBaseSchema.extend({
    method: z.literal('deposit'),
    assets: z.bigint(),
    referral: z.number().int().nullable(),
  }),
  Erc4626VaultCallBaseSchema.extend({
    method: z.literal('mint'),
    shares: z.bigint(),
    referral: z.number().int().nullable(),
  }),
  Erc4626VaultCallBaseSchema.extend({
    method: z.literal('withdraw'),
    assets: z.bigint(),
    owner: AddressSchema,
  }),
  Erc4626VaultCallBaseSchema.extend({
    method: z.literal('redeem'),
    shares: z.bigint(),
    owner: AddressSchema,
  }),
]);

export type Erc4626VaultCall = z.infer<typeof Erc4626VaultCallSchema>;

export const Erc4626VaultAssetSchema = z.object({
  address: AddressSchema,
  decimals: z.number().int().nonnegative(),
  symbol: z.string(),
});

/**
 * A curated vault. The allowlist entry is the trust anchor: any contract can
 * answer `asset()`/`convertToAssets()`, so on-chain responses alone never make
 * a contract a vault.
 */
export const Erc4626VaultSchema = z.object({
  chainId: z.string(),
  address: AddressSchema,
  name: z.string(),
  protocol: z.string(),
  asset: Erc4626VaultAssetSchema,
});

export type Erc4626Vault = z.infer<typeof Erc4626VaultSchema>;

/**
 * Internal (not yet public) decoded view of a call to an allowlisted vault.
 * Amounts are raw base-unit integer strings; `assets` is denominated in the
 * vault's underlying asset, `shares` is set only when the calldata carries it.
 */
export const Erc4626VaultTransactionSchema = z.object({
  method: z.enum(Erc4626VaultMethods),
  vault: Erc4626VaultSchema.omit({ asset: true }),
  asset: Erc4626VaultAssetSchema,
  assets: NonNegativeNumericStringSchema,
  shares: NonNegativeNumericStringSchema.nullable(),
  receiver: AddressSchema,
  owner: AddressSchema.nullable(),
  referral: z.number().int().nullable(),
});

export type Erc4626VaultTransaction = z.infer<
  typeof Erc4626VaultTransactionSchema
>;
