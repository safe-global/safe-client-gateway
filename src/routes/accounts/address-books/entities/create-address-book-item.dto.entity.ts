import { CreateAddressBookItemDto as DomainCreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAddressBookItemDto
  implements DomainCreateAddressBookItemDto
{
  @ApiProperty()
  name!: string;
  @ApiProperty()
  address!: `0x${string}`;
}
