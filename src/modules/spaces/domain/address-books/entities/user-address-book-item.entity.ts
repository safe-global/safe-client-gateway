// SPDX-License-Identifier: FSL-1.1-MIT
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceSchema } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { makeNameSchema } from '@/domain/common/schemas/name.schema';
import { ADDRESS_BOOK_NAME_MAX_LENGTH } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import { z } from 'zod';
import type { Address } from 'viem';

// We need to explicitly define ZodType due to recursion
export const UserAddressBookItemSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    space: Space;
    creator: User;
    createdBy: Address;
    chainIds: Array<string>;
    address: Address;
    name: string;
  }
> = RowSchema.extend({
  space: z.lazy(() => SpaceSchema),
  creator: z.lazy(() => UserSchema),
  createdBy: AddressSchema as z.ZodType<Address>,
  chainIds: z.array(z.string()),
  address: AddressSchema as z.ZodType<Address>,
  name: makeNameSchema({ maxLength: ADDRESS_BOOK_NAME_MAX_LENGTH }),
});

export type UserAddressBookItem = z.infer<typeof UserAddressBookItemSchema>;
