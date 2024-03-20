import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const SafeSchema = z.object({
  address: AddressSchema,
  nonce: z.number(),
  threshold: z.number(),
  owners: z.array(AddressSchema),
  masterCopy: AddressSchema,
  modules: z.array(AddressSchema).nullish().default(null),
  fallbackHandler: AddressSchema,
  guard: AddressSchema,
  version: z.string().nullish().default(null),
});
