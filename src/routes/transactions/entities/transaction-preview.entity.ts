import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { TransactionData } from '@/routes/transactions/entities/transaction-data.entity';
import { TransactionInfoDto } from './transaction-info.dto.entity';

@ApiExtraModels(TransactionInfoDto)
export class TransactionPreview {
  @ApiProperty({ type: TransactionInfoDto, nullable: true })
  txInfo: TransactionInfoDto;
  @ApiProperty()
  txData: TransactionData;

  constructor(txInfo: TransactionInfoDto, txData: TransactionData) {
    this.txInfo = txInfo;
    this.txData = txData;
  }
}
