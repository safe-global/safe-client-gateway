// SPDX-License-Identifier: FSL-1.1-MIT

import type { Address } from 'viem';
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { makeNameSchema } from '@/domain/common/schemas/name.schema';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { ADDRESS_BOOK_NAME_MAX_LENGTH } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceSchema } from '@/modules/spaces/domain/entities/space.entity';
import { MemberSchema } from '@/modules/users/domain/entities/member.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export enum AddressBookRequestStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
}

// We need to explicitly define ZodType due to recursion
export const AddressBookRequestSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    space: Space;
    requestedBy: User;
    chainIds: Array<string>;
    address: Address;
    name: string;
    status: keyof typeof AddressBookRequestStatus;
    reviewedBy: number | null;
  }
> = RowSchema.extend({
  space: z.lazy(() => SpaceSchema),
  requestedBy: z.lazy(() => UserSchema),
  chainIds: z.array(z.string()),
  address: AddressSchema as z.ZodType<Address>,
  name: makeNameSchema({ maxLength: ADDRESS_BOOK_NAME_MAX_LENGTH }),
  status: z.enum(getStringEnumKeys(AddressBookRequestStatus)),
  reviewedBy: MemberSchema.shape.invitedBy,
});

export type AddressBookRequest = z.infer<typeof AddressBookRequestSchema>;
