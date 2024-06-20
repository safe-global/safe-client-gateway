import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Account {
  @ApiProperty()
  accountId: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  groupId: string | null;
  @ApiProperty()
  address: `0x${string}`;

  constructor(
    accountId: string,
    groupId: string | null,
    address: `0x${string}`,
  ) {
    this.accountId = accountId;
    this.groupId = groupId;
    this.address = address;
  }
}
