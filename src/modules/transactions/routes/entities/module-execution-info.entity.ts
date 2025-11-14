import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  ExecutionInfo,
  ExecutionInfoType,
} from '@/modules/transactions/routes/entities/execution-info.entity';

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
