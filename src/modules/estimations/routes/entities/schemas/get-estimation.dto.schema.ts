import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { NullableHexSchema } from '@/validation/entities/schemas/nullable.schema';

export const GetEstimationDtoSchema = z.object({
  to: AddressSchema,
  value: NumericStringSchema,
  data: NullableHexSchema,
  operation: z.enum(Operation),
});
