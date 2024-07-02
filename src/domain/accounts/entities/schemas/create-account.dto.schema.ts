import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const CreateAccountDtoSchema = z.object({
  address: AddressSchema,
});
