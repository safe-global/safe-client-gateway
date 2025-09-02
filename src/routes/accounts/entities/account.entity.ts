import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';

export class Account {
  @ApiProperty()
  id: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  groupId: string | null;
  @ApiProperty()
  address: Address;
  @ApiProperty()
  name: string;

  constructor(
    id: string,
    groupId: string | null,
    address: Address,
    name: string,
  ) {
    this.id = id;
    this.groupId = groupId;
    this.address = address;
    this.name = name;
  }
}
