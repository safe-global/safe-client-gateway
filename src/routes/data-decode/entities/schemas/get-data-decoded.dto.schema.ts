import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const GetDataDecodedDtoSchema = z.object({
  data: HexSchema,
  to: AddressSchema.optional(),
});
