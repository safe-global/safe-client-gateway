// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import {
  ExecutionInfo,
  ExecutionInfoType,
} from '@/modules/transactions/routes/entities/execution-info.entity';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';

export class ModuleExecutionInfo extends ExecutionInfo {
  @ApiProperty({ enum: [ExecutionInfoType.Module] })
  override type = ExecutionInfoType.Module;
  @ApiProperty()
  address: AddressInfo;

  constructor(address: AddressInfo) {
    super(ExecutionInfoType.Module);
    this.address = address;
  }
}
