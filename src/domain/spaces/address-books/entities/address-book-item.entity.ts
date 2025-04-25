import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NameSchema } from '@/domain/common/entities/name.schema';
import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AddressBookItemSchema = z.object({
  chainIds: z.array(z.string()),
  address: AddressSchema,
  name: NameSchema,
});

export type AddressBookItem = z.infer<typeof AddressBookItemSchema>;
