import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const CreateDelegateDtoSchema = z.object({
  safe: AddressSchema.optional().nullable().default(null),
  delegate: AddressSchema,
  delegator: AddressSchema,
  signature: z.string(),
  label: z.string(),
});
