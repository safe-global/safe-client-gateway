import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { Operation } from '@/domain/safe/entities/operation.entity';

export const GetEstimationDtoSchema = z.object({
  to: AddressSchema,
  value: NumericStringSchema,
  data: HexSchema.nullish().default(null),
  operation: z.nativeEnum(Operation),
});
