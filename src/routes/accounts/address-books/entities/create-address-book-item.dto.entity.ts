import { CreateAddressBookItemDto as DomainCreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from '@/domain/common/entities/name.schema';
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export class CreateAddressBookItemDto
  implements DomainCreateAddressBookItemDto
{
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  name!: string;
  @ApiProperty()
  address!: Address;
}
