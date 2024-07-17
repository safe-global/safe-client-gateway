import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Account {
  @ApiProperty()
  id: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  groupId: string | null;
  @ApiProperty()
  address: `0x${string}`;

  constructor(id: string, groupId: string | null, address: `0x${string}`) {
    this.id = id;
    this.groupId = groupId;
    this.address = address;
  }
}
