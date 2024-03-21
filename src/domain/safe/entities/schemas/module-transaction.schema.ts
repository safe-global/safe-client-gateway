import { buildZodPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { DataDecodedSchema } from '@/domain/data-decoder/entities/schemas/data-decoded.schema';
import { Operation } from '@/domain/safe/entities/operation.entity';

export const ModuleTransactionSchema = z.object({
  safe: AddressSchema,
  to: AddressSchema,
  value: z.string().nullish().default(null),
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

export const ModuleTransactionPageSchema = buildZodPageSchema(
  ModuleTransactionSchema,
);
