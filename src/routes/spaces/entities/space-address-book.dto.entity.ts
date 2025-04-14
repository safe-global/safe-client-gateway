import { AddressBookItem } from '@/domain/spaces/address-books/entities/address-book-item.entity';
import { ApiProperty } from '@nestjs/swagger';

export class SpaceAddressBookItemDto {
  @ApiProperty({ type: String })
  public id!: AddressBookItem['id'];

  @ApiProperty({ type: String })
  public name!: AddressBookItem['name'];

  @ApiProperty({ type: String })
  public address!: AddressBookItem['address'];

  @ApiProperty({ type: String, isArray: true })
  public chainIds!: AddressBookItem['chainIds'];
}

export class SpaceAddressBookDto {
  @ApiProperty({ type: String })
  public spaceId!: string;

  @ApiProperty({ type: SpaceAddressBookItemDto, isArray: true })
  public data!: Array<SpaceAddressBookItemDto>;
}
