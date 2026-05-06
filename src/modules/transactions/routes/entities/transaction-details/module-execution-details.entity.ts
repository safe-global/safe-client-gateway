// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import {
  ExecutionDetails,
  ExecutionDetailsType,
} from '@/modules/transactions/routes/entities/transaction-details/execution-details.entity';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';

export class ModuleExecutionDetails extends ExecutionDetails {
  @ApiProperty({ enum: [ExecutionDetailsType.Module] })
  override type = ExecutionDetailsType.Module;
  @ApiProperty()
  address: AddressInfo;

  constructor(address: AddressInfo) {
    super(ExecutionDetailsType.Module);
    this.address = address;
  }
}
