// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiPropertyOptional } from '@nestjs/swagger';
import z from 'zod';
import {
  AddressBookItem,
  AddressBookItemSchema,
} from '#/modules/spaces/routes/address-books/entities/upsert-address-book-items.dto.entity';
import {
  SpaceSafeDto,
  SpaceSafesDto,
  SpaceSafesSchema,
} from '#/modules/spaces/routes/safes/entities/space-safe.dto.entity';

export const CreateSpaceSafesSchema = SpaceSafesSchema.extend({
  addressBookItems: z.array(AddressBookItemSchema).optional(),
});

export class CreateSpaceSafeDto extends SpaceSafeDto {}
export class CreateSpaceSafesDto
  extends SpaceSafesDto
  implements z.infer<typeof CreateSpaceSafesSchema>
{
  @ApiPropertyOptional({
    type: AddressBookItem,
    isArray: true,
    description:
      'Address book entries to upsert for the added Safes, in the same transaction: if either write fails, neither is kept.',
  })
  public readonly addressBookItems?: Array<AddressBookItem>;
}
