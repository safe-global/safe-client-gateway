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

  constructor(
    to: AddressInfo,
    dataSize: string,
    value: string | null,
    methodName: string | null,
    isCancellation: boolean,
    humanDescription: string | null,
  ) {
    super(TransactionInfoType.Custom, humanDescription);
    this.to = to;
    this.dataSize = dataSize;
    this.value = value;
    this.methodName = methodName;
    this.isCancellation = isCancellation;
  }
}

export class MultiSendTransactionInfo extends TransactionInfo {
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
  @ApiProperty({ enum: ['multiSend'] })
  methodName: 'multiSend'; // Always 'multiSend' for this type
  @ApiProperty({ type: Number })
  actionCount: number; // Always present and meaningful for MultiSend

  constructor(
    to: AddressInfo,
    dataSize: string,
    value: string | null,
    actionCount: number,
    isCancellation: boolean,
    humanDescription: string | null,
  ) {
    super(TransactionInfoType.Custom, humanDescription);
    this.to = to;
    this.dataSize = dataSize;
    this.value = value;
    this.methodName = 'multiSend';
    this.actionCount = actionCount;
    this.isCancellation = isCancellation;
  }
}
