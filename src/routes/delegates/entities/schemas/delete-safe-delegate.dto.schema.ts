import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const DeleteSafeDelegateDtoSchema = z.object({
  delegate: AddressSchema,
  safe: AddressSchema,
  signature: z.string(),
});
