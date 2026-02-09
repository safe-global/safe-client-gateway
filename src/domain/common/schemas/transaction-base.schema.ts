import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

export const TransactionBaseSchema = z.object({
  to: AddressSchema,
  value: NumericStringSchema,
  data: HexSchema,
  operation: z.enum(Operation),
});
