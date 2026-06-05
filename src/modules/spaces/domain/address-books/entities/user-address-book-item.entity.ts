// SPDX-License-Identifier: FSL-1.1-MIT

import type { Address } from 'viem';
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressBookItemSchema } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceSchema } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

// We need to explicitly define ZodType due to recursion
export const UserAddressBookItemSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    space: Space;
    creator: User;
    chainIds: Array<string>;
    address: Address;
    name: string;
  }
> = RowSchema.extend({
  space: z.lazy(() => SpaceSchema),
  creator: z.lazy(() => UserSchema),
  chainIds: z.array(ChainIdSchema),
  address: AddressSchema,
  name: AddressBookItemSchema.shape.name,
});

export type UserAddressBookItem = z.infer<typeof UserAddressBookItemSchema>;
