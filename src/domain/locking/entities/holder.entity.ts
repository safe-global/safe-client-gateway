import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const HolderSchema = z.object({
  holder: AddressSchema,
  position: z.number(),
  boost: NumericStringSchema,
  points: NumericStringSchema,
  boostedPoints: NumericStringSchema,
});

export const HolderPageSchema = buildPageSchema(HolderSchema);

export type Holder = z.infer<typeof HolderSchema>;
