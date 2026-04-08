// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';
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
