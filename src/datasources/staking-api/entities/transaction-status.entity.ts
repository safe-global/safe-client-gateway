import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const TransactionStatusReceiptLogSchema = z.object({
  address: AddressSchema,
  topics: z.array(HexSchema),
  data: HexSchema,
  blockHash: HexSchema,
  blockNumber: NumericStringSchema,
  blockTimestamp: HexSchema,
  transactionHash: HexSchema,
  transactionIndex: z.number(),
  logIndex: z.number(),
  removed: z.boolean(),
});

export const TransactionStatusReceiptSchema = z.object({
  status: z.enum(['success', 'unknown']).catch('unknown'),
  cumulativeGasUsed: NumericStringSchema,
  logs: z.array(TransactionStatusReceiptLogSchema),
  logsBloom: HexSchema,
  type: z.enum(['eip1559', 'unknown']).catch('unknown'),
  transactionHash: HexSchema,
  transactionIndex: z.number(),
  blockHash: HexSchema,
  blockNumber: NumericStringSchema,
  gasUsed: NumericStringSchema,
  effectiveGasPrice: NumericStringSchema,
  from: AddressSchema,
  to: AddressSchema,
  contractAddress: AddressSchema.nullish().default(null),
});

export const TransactionStatusSchema = z.object({
  receipt: TransactionStatusReceiptSchema,
  status: z.enum(['success', 'unknown']).catch('unknown'),
});

export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;
