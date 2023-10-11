import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { ExecutionInfo } from './execution-info.entity';

export class ModuleExecutionInfo extends ExecutionInfo {
  @ApiProperty()
  address: AddressInfo;

  constructor(address: AddressInfo) {
    super('MODULE');
    this.address = address;
  }
}
