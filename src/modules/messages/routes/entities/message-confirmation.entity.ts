import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import type { Hex } from 'viem';

export class MessageConfirmation {
  @ApiProperty()
  owner: AddressInfo;
  @ApiProperty()
  signature: Hex;

  constructor(owner: AddressInfo, signature: Hex) {
    this.owner = owner;
    this.signature = signature;
  }
}
