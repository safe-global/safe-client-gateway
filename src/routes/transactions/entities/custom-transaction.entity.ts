import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { TransactionInfo } from './transaction-info.entity';

export class CustomTransactionInfo extends TransactionInfo {
  @ApiProperty()
  to: AddressInfo | null;
  @ApiProperty()
  dataSize: string;
  @ApiProperty()
  value: string;
  @ApiProperty()
  isCancellation: boolean;
  @ApiPropertyOptional({ type: String, nullable: true })
  methodName: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  actionCount: number | null;
}
