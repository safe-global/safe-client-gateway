import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';

export class CustomTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.Custom] })
  override type = TransactionInfoType.Custom;
  @ApiProperty()
  to: AddressInfo;
  @ApiProperty()
  dataSize: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  value: string | null;
  @ApiProperty()
  isCancellation: boolean;
  @ApiPropertyOptional({ type: String, nullable: true })
  methodName: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  actionCount: number | null;

  constructor(
    to: AddressInfo,
    dataSize: string,
    value: string | null,
    methodName: string | null,
    actionCount: number | null,
    isCancellation: boolean,
    humanDescription: string | null,
  ) {
    super(TransactionInfoType.Custom, humanDescription);
    this.to = to;
    this.dataSize = dataSize;
    this.value = value;
    this.methodName = methodName;
    this.actionCount = actionCount;
    this.isCancellation = isCancellation;
  }
}
