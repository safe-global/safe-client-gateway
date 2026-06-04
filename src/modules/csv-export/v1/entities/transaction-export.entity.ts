// SPDX-License-Identifier: FSL-1.1-MIT
import { formatUnits, isAddressEqual, zeroAddress } from 'viem';
import { z } from 'zod';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const TransactionExportSchema = z
  .object({
    safe: AddressSchema,
    from: AddressSchema,
    to: AddressSchema,
    amount: NumericStringSchema,
    assetType: z.string(),
    assetAddress: AddressSchema.nullable(),
    assetSymbol: z.string().nullable(),
    assetDecimals: z.number().nullable(),
    proposerAddress: AddressSchema.nullable(),
    proposedAt: z.coerce.date().nullable(),
    executorAddress: AddressSchema.nullable(),
    executedAt: z.coerce.date().nullable(),
    note: z.string().nullable(),
    transactionHash: HexSchema,
    contractAddress: AddressSchema.nullable(),
    nonce: z.string().nullable(),
    gasToken: AddressSchema.nullish(),
    payment: NumericStringSchema.nullish(),
    gasTokenSymbol: z.string().nullish(),
    gasTokenDecimals: z.number().nullish(),
  })
  .transform(({ amount, assetDecimals, ...rest }) => ({
    ...rest,
    assetDecimals,
    amount: formatUnits(BigInt(amount), assetDecimals ?? 0),
  }));

export const TransactionExportPageSchema = buildPageSchema(
  TransactionExportSchema,
);

export type TransactionExport = z.infer<typeof TransactionExportSchema>;

/**
 * Formats the gas fee payment amount using the correct decimals and symbol.
 * When gasToken is the zero address (native token), uses chain nativeCurrency
 * values instead of the null gasTokenDecimals/gasTokenSymbol from the API.
 */
export function formatTransactionExportGasFees(
  tx: TransactionExport,
  nativeDecimals: number,
  nativeSymbol: string,
): TransactionExport {
  const { payment, gasToken, gasTokenDecimals, gasTokenSymbol } = tx;

  if (gasToken == null || payment == null) {
    return { ...tx, payment: null };
  }

  const isNativeToken = isAddressEqual(gasToken, zeroAddress);
  const decimals = isNativeToken ? nativeDecimals : (gasTokenDecimals ?? 0);

  return {
    ...tx,
    payment: formatUnits(BigInt(payment), decimals),
    gasTokenSymbol: isNativeToken ? nativeSymbol : (gasTokenSymbol ?? null),
  };
}
