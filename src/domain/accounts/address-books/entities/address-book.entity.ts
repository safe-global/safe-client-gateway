import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { AccountSchema } from '@/domain/accounts/entities/account.entity';
import { z } from 'zod';

export const AddressBookItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
});

export const AddressBookSchema = RowSchema.extend({
  accountId: AccountSchema.shape.id,
  chainId: z.string(),
  data: z.array(AddressBookItemSchema),
});

export type AddressBookItem = z.infer<typeof AddressBookItemSchema>;
export type AddressBook = z.infer<typeof AddressBookSchema>;
