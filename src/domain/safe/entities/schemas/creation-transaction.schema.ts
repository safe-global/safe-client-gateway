import { DataDecodedSchema } from '@/domain/data-decoder/entities/schemas/data-decoded.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const CreationTransactionSchema = z.object({
  created: z.coerce.date(),
  creator: AddressSchema,
  transactionHash: z.string(),
  factoryAddress: AddressSchema,
  masterCopy: AddressSchema.nullable(),
  setupData: z.string().nullable(),
  dataDecoded: DataDecodedSchema.nullable(),
});
