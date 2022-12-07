import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { TransactionInfo } from './multisig-transaction.entity';

export class CustomTransactionInfo extends TransactionInfo {
  @ApiProperty()
  to: AddressInfo | null;
  @ApiProperty()
  dataSize: string;
  @ApiProperty()
  value: string;
  @ApiProperty()
  methodName: string;
  @ApiPropertyOptional()
  actionCount?: number;
  @ApiProperty()
  isCancellation: boolean;
}
