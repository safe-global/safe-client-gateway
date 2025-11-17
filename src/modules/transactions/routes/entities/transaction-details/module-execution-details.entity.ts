import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  ExecutionDetails,
  ExecutionDetailsType,
} from '@/modules/transactions/routes/entities/transaction-details/execution-details.entity';

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
