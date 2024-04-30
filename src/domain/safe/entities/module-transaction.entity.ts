import { DataDecodedSchema } from '@/domain/data-decoder/entities/schemas/data-decoded.schema';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export type ModuleTransaction = z.infer<typeof ModuleTransactionSchema>;

export const ModuleTransactionSchema = z.object({
  safe: AddressSchema,
  to: AddressSchema,
  value: NumericStringSchema.nullish().default(null),
  data: HexSchema.nullish().default(null),
  dataDecoded: DataDecodedSchema.nullish().default(null),
  operation: z.nativeEnum(Operation),
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
