import { ApiProperty } from '@nestjs/swagger';

export class Wallet {
  @ApiProperty()
  id: string;
  user: string;
  address: `0x${string}`;
  constructor(id: string, user: string, address: `0x${string}`) {
    this.id = id;
    this.user = user;
    this.address = address;
  }
}
