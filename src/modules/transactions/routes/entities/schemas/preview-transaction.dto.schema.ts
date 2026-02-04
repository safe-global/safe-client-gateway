import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { NullableHexSchema } from '@/validation/entities/schemas/nullable.schema';

export const PreviewTransactionDtoSchema = z.object({
  to: AddressSchema,
  data: NullableHexSchema,
  value: z.string(),
  operation: z.enum(Operation),
});
