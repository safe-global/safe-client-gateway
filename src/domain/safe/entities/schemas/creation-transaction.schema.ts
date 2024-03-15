import { DataDecodedSchema } from '@/domain/data-decoder/entities/schemas/data-decoded.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';

export const CreationTransactionSchema = z.object({
  created: z.coerce.date(),
  creator: AddressSchema,
  transactionHash: HexSchema,
  factoryAddress: AddressSchema,
  masterCopy: AddressSchema.nullish().default(null),
  setupData: HexSchema.nullish().default(null),
  dataDecoded: DataDecodedSchema.nullish().default(null),
});
