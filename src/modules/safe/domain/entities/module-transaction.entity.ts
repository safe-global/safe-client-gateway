import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { TransactionBaseSchema } from '@/domain/common/schemas/transaction-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';
import {
  NullableHexSchema,
  NullableNumericStringSchema,
} from '@/validation/entities/schemas/nullable.schema';

export type ModuleTransaction = z.infer<typeof ModuleTransactionSchema>;

export const ModuleTransactionSchema = TransactionBaseSchema.extend({
  safe: AddressSchema,
  value: NullableNumericStringSchema,
  data: NullableHexSchema,
  created: z.coerce.date(),
  executionDate: z.coerce.date(),
  blockNumber: z.number(),
  isSuccessful: z.boolean(),
  transactionHash: HexSchema,
  module: AddressSchema,
  moduleTransactionId: z.string(),
});

export const ModuleTransactionTypeSchema = ModuleTransactionSchema.extend({
  txType: z.literal('MODULE_TRANSACTION'),
});

export const ModuleTransactionPageSchema = buildPageSchema(
  ModuleTransactionSchema,
);
