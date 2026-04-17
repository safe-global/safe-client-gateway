// SPDX-License-Identifier: FSL-1.1-MIT
import { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import { ApiProperty } from '@nestjs/swagger';

export class SpaceAddressBookItemDto {
  @ApiProperty({ type: String })
  public name!: AddressBookDbItem['name'];

  @ApiProperty({ type: String })
  public address!: AddressBookDbItem['address'];

  @ApiProperty({ type: String, isArray: true })
  public chainIds!: AddressBookDbItem['chainIds'];

  @ApiProperty({ type: String })
  public createdBy!: AddressBookDbItem['createdBy'];

  @ApiProperty({ type: String })
  public lastUpdatedBy!: AddressBookDbItem['lastUpdatedBy'];

  @ApiProperty()
  public createdAt!: AddressBookDbItem['createdAt'];

  @ApiProperty()
  public updatedAt!: AddressBookDbItem['updatedAt'];
}

export class SpaceAddressBookDto {
  @ApiProperty({ type: String })
  public spaceId!: string;

  @ApiProperty({ type: SpaceAddressBookItemDto, isArray: true })
  public data!: Array<SpaceAddressBookItemDto>;
}

export class UserAddressBookItemDto {
  @ApiProperty({ type: String })
  public name!: AddressBookDbItem['name'];

  @ApiProperty({ type: String })
  public address!: AddressBookDbItem['address'];

  @ApiProperty({ type: String, isArray: true })
  public chainIds!: AddressBookDbItem['chainIds'];

  @ApiProperty({ type: String })
  public createdBy!: AddressBookDbItem['createdBy'];

  @ApiProperty()
  public createdAt!: AddressBookDbItem['createdAt'];

  @ApiProperty()
  public updatedAt!: AddressBookDbItem['updatedAt'];
}

export class UserAddressBookDto {
  @ApiProperty({ type: String })
  public spaceId!: string;

  @ApiProperty({ type: UserAddressBookItemDto, isArray: true })
  public data!: Array<UserAddressBookItemDto>;
}
