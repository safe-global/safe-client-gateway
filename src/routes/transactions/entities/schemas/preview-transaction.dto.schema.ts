import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const PreviewTransactionDtoSchema = z.object({
  to: AddressSchema,
  data: HexSchema.nullish().default(null),
  value: z.string(),
  // TODO: Reference Operation enum
  operation: z.literal(0).or(z.literal(1)),
});
