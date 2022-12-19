import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { ExecutionInfo } from './execution-info.entity';

export class ModuleExecutionInfo extends ExecutionInfo {
  @ApiProperty()
  address: AddressInfo;

  constructor(address: AddressInfo) {
    super('MODULE');
    this.address = address;
  }
}
