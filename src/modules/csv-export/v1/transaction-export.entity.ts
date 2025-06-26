import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const TransactionExportSchema = z.object({
  safe: AddressSchema,
  from: AddressSchema,
  to: AddressSchema,
  amount: NumericStringSchema,
  assetType: z.string(), //z.enum(['native', 'erc20', 'erc721']),
  assetAddress: AddressSchema,
  assetSymbol: z.string(),
  assetDecimals: z.number(),
  proposerAddress: AddressSchema,
  proposedAt: z.coerce.date(),
  executorAddress: AddressSchema,
  executedAt: z.coerce.date(),
  note: z.string(),
  transactionHash: HexSchema,
  safeTxHash: HexSchema,
  method: z.string(),
  contractAddress: AddressSchema,
  isExecuted: z.boolean(),
});

export const TransactionExportPageSchema = buildPageSchema(
  TransactionExportSchema,
);

export type TransactionExport = z.infer<typeof TransactionExportSchema>;
