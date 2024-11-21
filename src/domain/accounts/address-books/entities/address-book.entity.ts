import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { AddressBookItemNameSchema } from '@/domain/accounts/address-books/entities/schemas/address-book-item-name.schema';
import { AccountSchema } from '@/domain/accounts/entities/account.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const AddressBookItemSchema = z.object({
  // TODO: add limitation to the id according to MAX_ADDRESS_BOOK_ITEMS
  id: z.number().int().gte(1),
  name: AddressBookItemNameSchema,
  address: AddressSchema,
});

export const AddressBookSchema = RowSchema.extend({
  accountId: AccountSchema.shape.id,
  chainId: z.string(),
  data: z.array(AddressBookItemSchema),
});

export type AddressBookItem = z.infer<typeof AddressBookItemSchema>;
export type AddressBook = z.infer<typeof AddressBookSchema>;
