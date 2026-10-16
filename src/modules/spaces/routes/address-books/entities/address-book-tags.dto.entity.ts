// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import type {
  AddressBookTag,
  TagColor,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import {
  MAX_CONTACTS_PER_TAG_UPDATE,
  MAX_TAGS_PER_CONTACT,
  TAG_COLORS,
  TAG_NAME_MAX_LENGTH,
  TagNameSchema,
  TagNamesSchema,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';

const SetContactTagsItemSchema = z.object({
  address: AddressSchema,
  tags: TagNamesSchema,
});

export const SetContactTagsSchema = z.object({
  items: z
    .array(SetContactTagsItemSchema)
    .min(1)
    .max(MAX_CONTACTS_PER_TAG_UPDATE)
    .refine(
      (items) =>
        new Set(items.map((item) => item.address.toLowerCase())).size ===
        items.length,
      { message: 'Each address can appear only once' },
    ),
});

export class SetContactTagsItem
  implements z.infer<typeof SetContactTagsItemSchema>
{
  @ApiProperty({ type: String })
  public readonly address!: Address;

  @ApiProperty({
    type: String,
    isArray: true,
    maxItems: MAX_TAGS_PER_CONTACT,
    description: 'The full set of tag names for the contact',
  })
  public readonly tags!: Array<string>;
}

@ApiExtraModels(SetContactTagsItem)
export class SetContactTagsDto implements z.infer<typeof SetContactTagsSchema> {
  @ApiProperty({
    items: { $ref: getSchemaPath(SetContactTagsItem) },
    type: 'array',
    minItems: 1,
    maxItems: MAX_CONTACTS_PER_TAG_UPDATE,
  })
  public readonly items!: Array<SetContactTagsItem>;
}

export const RenameTagSchema = z.object({
  name: TagNameSchema,
});

export class RenameTagDto implements z.infer<typeof RenameTagSchema> {
  @ApiProperty({ type: String, maxLength: TAG_NAME_MAX_LENGTH })
  public readonly name!: string;
}

export class SpaceAddressBookTagDto implements AddressBookTag {
  @ApiProperty({ type: Number })
  public id!: number;

  @ApiProperty({ type: String })
  public name!: string;

  @ApiProperty({ enum: TAG_COLORS })
  public color!: TagColor;

  @ApiProperty({
    type: Number,
    description: 'Number of contacts that have this tag',
  })
  public contactCount!: number;
}
