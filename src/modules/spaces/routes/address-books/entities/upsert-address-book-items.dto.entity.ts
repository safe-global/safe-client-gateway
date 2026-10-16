// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressBookItemSchema as BaseAddressBookItemSchema } from '#/modules/spaces/domain/address-books/entities/address-book-item.entity';
import {
  MAX_TAGS_PER_CONTACT,
  TagNamesSchema,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';

const AddressBookItemSchema = z.object({
  name: BaseAddressBookItemSchema.shape.name,
  address: AddressSchema,
  chainIds: z.array(ChainIdSchema),
  tags: TagNamesSchema.optional(),
});

export class AddressBookItem implements z.infer<typeof AddressBookItemSchema> {
  @ApiProperty({ type: String })
  readonly name!: string;

  @ApiProperty({ type: String })
  readonly address!: Address;

  @ApiProperty({ type: String, isArray: true })
  readonly chainIds!: Array<string>;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    maxItems: MAX_TAGS_PER_CONTACT,
    description:
      'Tag names of the contact (replaces the current tags when provided; omit to leave them unchanged)',
  })
  readonly tags?: Array<string>;
}

export const UpsertAddressBookItemsSchema = z.object({
  items: z.array(AddressBookItemSchema),
});

@ApiExtraModels(AddressBookItem)
export class UpsertAddressBookItemsDto
  implements z.infer<typeof UpsertAddressBookItemsSchema>
{
  @ApiProperty({
    items: { $ref: getSchemaPath(AddressBookItem) },
    type: 'array',
  })
  public readonly items!: Array<AddressBookItem>;
}
