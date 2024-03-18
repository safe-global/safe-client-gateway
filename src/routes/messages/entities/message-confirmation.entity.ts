import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';

export class MessageConfirmation {
  @ApiProperty()
  owner: AddressInfo;
  @ApiProperty()
  signature: `0x${string}`;

  constructor(owner: AddressInfo, signature: `0x${string}`) {
    this.owner = owner;
    this.signature = signature;
  }
}
