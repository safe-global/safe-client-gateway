import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { AccountSchema } from '@/domain/accounts/entities/account.entity';
import { z } from 'zod';

export type AddressBook = z.infer<typeof AddressBookSchema>;

export const AddressBookSchema = RowSchema.extend({
  data: z.object({}),
  accountId: AccountSchema.shape.id,
});
