import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { TransactionInfo } from './transaction-info.entity';
import { RichHumanDescriptionFragment } from '@/routes/transactions/entities/human-description.entity';

export class CustomTransactionInfo extends TransactionInfo {
  @ApiProperty()
  to: AddressInfo;
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

  constructor(
    to: AddressInfo,
    dataSize: string,
    value: string,
    methodName: string | null,
    actionCount: number | null,
    isCancellation: boolean,
    humanDescription: RichHumanDescriptionFragment[] | null,
  ) {
    super('Custom', humanDescription);
    this.to = to;
    this.dataSize = dataSize;
    this.value = value;
    this.methodName = methodName;
    this.actionCount = actionCount;
    this.isCancellation = isCancellation;
  }
}
