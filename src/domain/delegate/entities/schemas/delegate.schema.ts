import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const DelegateSchema = z.object({
  safe: AddressSchema.optional().nullable().default(null),
  delegate: AddressSchema,
  delegator: AddressSchema,
  label: z.string(),
});
