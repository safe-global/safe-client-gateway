import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

// TODO: merge with CreateAccountDto entity

export const CreateAccountDtoSchema = z.object({
  address: AddressSchema,
});
