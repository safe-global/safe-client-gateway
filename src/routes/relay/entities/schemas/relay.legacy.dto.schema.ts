import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const RelayLegacyDtoSchema = z.object({
  chainId: NumericStringSchema,
  to: AddressSchema,
  data: HexSchema,
  gasLimit: z.string().nullish().default(null),
});
