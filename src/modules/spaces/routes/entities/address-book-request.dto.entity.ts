// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import {
  ADDRESS_BOOK_NAME_MAX_LENGTH,
  AddressBookItemSchema,
} from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import { AddressBookRequestStatus } from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';

export class AddressBookRequestItemDto {
  @ApiProperty()
  public id!: number;

  @ApiProperty({ type: String })
  public name!: string;

  @ApiProperty({ type: String })
  public address!: string;

  @ApiProperty({ type: String, isArray: true })
  public chainIds!: Array<string>;

  @ApiProperty({
    type: String,
    description:
      'Email or wallet address of the requester, "Unknown user" if the user has no display identity, or "Deleted user"',
  })
  public requestedBy!: string;

  @ApiProperty({ type: Number, description: 'User ID of the requester' })
  public requestedByUserId!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Email or wallet address of the reviewing admin, "Unknown user", "Deleted user", or null when still PENDING',
  })
  public reviewedBy!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'User ID of the reviewing admin, null when still PENDING',
  })
  public reviewedByUserId!: number | null;

  @ApiProperty({ enum: getStringEnumKeys(AddressBookRequestStatus) })
  public status!: keyof typeof AddressBookRequestStatus;

  @ApiProperty()
  public createdAt!: Date;

  @ApiProperty()
  public updatedAt!: Date;
}

export class AddressBookRequestsDto {
  @ApiProperty({
    type: String,
    deprecated: true,
    description:
      'Numeric Space id (deprecated, use spaceUuid). Kept for FE fallback',
  })
  public spaceId!: string;

  @ApiProperty({ type: String, description: 'Space UUID' })
  public spaceUuid!: string;

  @ApiProperty({ type: AddressBookRequestItemDto, isArray: true })
  public data!: Array<AddressBookRequestItemDto>;
}

export const CreateAddressBookRequestSchema = AddressBookItemSchema.extend({
  chainIds: z
    .array(ChainIdSchema)
    .min(1)
    .transform((chainIds) => Array.from(new Set(chainIds))),
});

export class CreateAddressBookRequestDto
  implements z.infer<typeof CreateAddressBookRequestSchema>
{
  @ApiProperty({
    type: String,
    maxLength: ADDRESS_BOOK_NAME_MAX_LENGTH,
    description: 'Name of the proposed contact',
  })
  public readonly name!: string;

  @ApiProperty({
    type: String,
    description: 'Address of the contact to propose for the space address book',
  })
  public readonly address!: Address;

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      'Chain ids the contact applies to (at least one, duplicates are removed)',
  })
  public readonly chainIds!: Array<string>;
}
