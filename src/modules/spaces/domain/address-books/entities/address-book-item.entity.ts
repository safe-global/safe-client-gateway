import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { makeNameSchema } from '@/domain/common/entities/name.schema';
import { z } from 'zod';

export const ADDRESS_BOOK_NAME_MAX_LENGTH = 50;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AddressBookItemSchema = z.object({
  chainIds: z.array(z.string()),
  address: AddressSchema,
  name: makeNameSchema({ maxLength: ADDRESS_BOOK_NAME_MAX_LENGTH }),
});

export type AddressBookItem = z.infer<typeof AddressBookItemSchema>;
