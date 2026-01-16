import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const GetDelegateDtoSchema = z
  .object({
    safe: AddressSchema.optional(),
    delegate: AddressSchema.optional(),
    delegator: AddressSchema.optional(),
    label: z.string().optional(),
  })
  .refine(
    (value) => {
      return Object.values(value).some(Boolean);
    },
    { error: 'At least one property is required' },
  );
