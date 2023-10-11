import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { ExecutionDetails } from '@/routes/transactions/entities/transaction-details/execution-details.entity';

export class ModuleExecutionDetails extends ExecutionDetails {
  @ApiProperty()
  address: AddressInfo;

  constructor(address: AddressInfo) {
    super('MODULE');
    this.address = address;
  }
}
