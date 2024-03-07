import { DataDecodedSchema } from '@/domain/data-decoder/entities/schemas/data-decoded.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const CreationTransactionSchema = z.object({
  created: z.coerce.date(),
  creator: AddressSchema,
  transactionHash: z.string(),
  factoryAddress: AddressSchema,
  masterCopy: AddressSchema.optional().nullable().default(null),
  setupData: z.string().optional().nullable().default(null),
  dataDecoded: DataDecodedSchema.optional().nullable().default(null),
});
