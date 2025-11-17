import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const SafeListSchema = z.object({
  safes: z.array(AddressSchema),
});
