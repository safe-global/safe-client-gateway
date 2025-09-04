import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import type { Space } from '@/domain/spaces/entities/space.entity';
import { SpaceSchema } from '@/domain/spaces/entities/space.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { makeNameSchema } from '@/domain/common/entities/name.schema';
import { z } from 'zod';
import { ADDRESS_BOOK_NAME_MAX_LENGTH } from '@/domain/accounts/address-books/entities/address-book.entity';
import type { Address } from 'viem';

// We need explicitly define ZodType due to recursion
export const AddressBookDbItemSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    space: Space;
    chainIds: Array<string>;
    address: Address;
    name: string;
    createdBy: Address;
    lastUpdatedBy: Address;
  }
> = RowSchema.extend({
  space: z.lazy(() => SpaceSchema),
  chainIds: z.array(z.string()),
  address: AddressSchema as z.ZodType<Address>,
  name: makeNameSchema({ maxLength: ADDRESS_BOOK_NAME_MAX_LENGTH }),
  createdBy: AddressSchema as z.ZodType<Address>,
  lastUpdatedBy: AddressSchema as z.ZodType<Address>,
});

export type AddressBookDbItem = z.infer<typeof AddressBookDbItemSchema>;
