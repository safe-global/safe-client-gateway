// SPDX-License-Identifier: FSL-1.1-MIT
import { formatUnits } from 'viem';
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
  .transform(
    ({ amount, assetDecimals, payment, gasTokenDecimals, ...rest }) => ({
      ...rest,
      assetDecimals,
      amount: formatUnits(BigInt(amount), assetDecimals ?? 0),
      gasTokenDecimals: gasTokenDecimals ?? null,
      payment:
        payment != null
          ? formatUnits(BigInt(payment), gasTokenDecimals ?? 0)
          : null,
    }),
  );

export const TransactionExportPageSchema = buildPageSchema(
  TransactionExportSchema,
);

export type TransactionExport = z.infer<typeof TransactionExportSchema>;
