import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NullableAddressSchema } from '@/validation/entities/schemas/nullable.schema';

export const CreateDelegateDtoSchema = z.object({
  safe: NullableAddressSchema,
  delegate: AddressSchema,
  delegator: AddressSchema,
  signature: z.string(),
  label: z.string(),
});
