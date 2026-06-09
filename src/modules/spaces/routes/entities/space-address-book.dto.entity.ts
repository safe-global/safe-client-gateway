// SPDX-License-Identifier: FSL-1.1-MIT

import { ApiProperty } from '@nestjs/swagger';
import type { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import type { UserAddressBookItem } from '@/modules/spaces/domain/address-books/entities/user-address-book-item.entity';

export class SpaceAddressBookItemDto {
  @ApiProperty({ type: String })
  public name!: AddressBookDbItem['name'];

  @ApiProperty({ type: String })
  public address!: AddressBookDbItem['address'];

  @ApiProperty({ type: String, isArray: true })
  public chainIds!: AddressBookDbItem['chainIds'];

  @ApiProperty({
    type: String,
    description:
      'Email or wallet address of the creator, "Unknown user" if the user has no display identity, or "Deleted user"',
  })
  public createdBy!: string;

  @ApiProperty({
    type: Number,
    description: 'User ID of the creator',
  })
  public createdByUserId!: number;

  @ApiProperty({
    type: String,
    description:
      'Email or wallet address of the last editor, "Unknown user" if the user has no display identity, or "Deleted user"',
  })
  public lastUpdatedBy!: string;

  @ApiProperty({
    type: Number,
    description: 'User ID of the last editor',
  })
  public lastUpdatedByUserId!: number;

  @ApiProperty({ type: Date })
  public createdAt!: AddressBookDbItem['createdAt'];

  @ApiProperty({ type: Date })
  public updatedAt!: AddressBookDbItem['updatedAt'];
}

export class SpaceAddressBookDto {
  @ApiProperty({
    type: String,
    deprecated: true,
    description:
      'Numeric Space id (deprecated, use spaceUuid). Kept for FE fallback',
  })
  public spaceId!: string;

  @ApiProperty({ type: String, description: 'Space UUID' })
  public spaceUuid!: string;

  @ApiProperty({ type: SpaceAddressBookItemDto, isArray: true })
  public data!: Array<SpaceAddressBookItemDto>;
}

export class UserAddressBookItemDto {
  @ApiProperty({ type: String })
  public name!: UserAddressBookItem['name'];

  @ApiProperty({ type: String })
  public address!: UserAddressBookItem['address'];

  @ApiProperty({ type: String, isArray: true })
  public chainIds!: UserAddressBookItem['chainIds'];

  @ApiProperty({
    type: String,
    description:
      'Email or wallet address of the creator, "Unknown user" if the user has no display identity, or "Deleted user"',
  })
  public createdBy!: string;

  @ApiProperty({ type: Number, description: 'User ID of the creator' })
  public createdByUserId!: number;

  @ApiProperty()
  public createdAt!: UserAddressBookItem['createdAt'];

  @ApiProperty()
  public updatedAt!: UserAddressBookItem['updatedAt'];
}

export class UserAddressBookDto {
  @ApiProperty({
    type: String,
    deprecated: true,
    description:
      'Numeric Space id (deprecated, use spaceUuid). Kept for FE fallback',
  })
  public spaceId!: string;

  @ApiProperty({ type: String, description: 'Space UUID' })
  public spaceUuid!: string;

  @ApiProperty({ type: UserAddressBookItemDto, isArray: true })
  public data!: Array<UserAddressBookItemDto>;
}
