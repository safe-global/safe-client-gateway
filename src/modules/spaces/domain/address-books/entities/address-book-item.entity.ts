// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { makeNameSchema } from '@/domain/common/schemas/name.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const ADDRESS_BOOK_NAME_MAX_LENGTH = 50;

const AddressBookItemSchema = z.object({
  chainIds: z.array(z.string()),
  address: AddressSchema,
  name: makeNameSchema({ maxLength: ADDRESS_BOOK_NAME_MAX_LENGTH }),
});

export type AddressBookItem = z.infer<typeof AddressBookItemSchema>;
