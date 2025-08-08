import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { formatUnits } from 'viem';
import { z } from 'zod';

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
