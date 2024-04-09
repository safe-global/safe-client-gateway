import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  ExecutionInfo,
  ExecutionInfoType,
} from '@/routes/transactions/entities/execution-info.entity';

export class MultisigExecutionInfo extends ExecutionInfo {
  @ApiProperty()
  nonce: number;
  @ApiPropertyOptional({ type: Number, nullable: true })
  confirmationsRequired: number | null;
  @ApiProperty()
  confirmationsSubmitted: number;
  @ApiPropertyOptional({ type: AddressInfo, isArray: true, nullable: true })
  missingSigners: AddressInfo[] | null;

  constructor(
    nonce: number,
    confirmationsRequired: number | null,
    confirmationsSubmitted: number,
    missingSigners: AddressInfo[] | null,
  ) {
    super(ExecutionInfoType.Multisig);
    this.nonce = nonce;
    this.confirmationsRequired = confirmationsRequired;
    this.confirmationsSubmitted = confirmationsSubmitted;
    this.missingSigners = missingSigners;
  }
}
