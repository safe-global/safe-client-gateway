import { AddressBookDbItem } from '@/domain/spaces/address-books/entities/address-book-item.db.entity';
import { ApiProperty } from '@nestjs/swagger';

export class SpaceAddressBookItemDto {
  @ApiProperty({ type: String })
  public id!: AddressBookDbItem['id'];

  @ApiProperty({ type: String })
  public name!: AddressBookDbItem['name'];

  @ApiProperty({ type: String })
  public address!: AddressBookDbItem['address'];

  @ApiProperty({ type: String, isArray: true })
  public chainIds!: AddressBookDbItem['chainIds'];
}

export class SpaceAddressBookDto {
  @ApiProperty({ type: String })
  public spaceId!: string;

  @ApiProperty({ type: SpaceAddressBookItemDto, isArray: true })
  public data!: Array<SpaceAddressBookItemDto>;
}
