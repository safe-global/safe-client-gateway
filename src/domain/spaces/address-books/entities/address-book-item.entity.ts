import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { makeNameSchema } from '@/domain/common/entities/name.schema';
import { z } from 'zod';
import { ADDRESS_BOOK_NAME_MAX_LENGTH } from '@/domain/accounts/address-books/entities/address-book.entity';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AddressBookItemSchema = z.object({
  chainIds: z.array(z.string()),
  address: AddressSchema,
  name: makeNameSchema({ maxLength: ADDRESS_BOOK_NAME_MAX_LENGTH }),
});

export type AddressBookItem = z.infer<typeof AddressBookItemSchema>;
