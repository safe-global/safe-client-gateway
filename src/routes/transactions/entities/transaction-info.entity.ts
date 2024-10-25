import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RichDecodedInfo } from '@/routes/transactions/entities/human-description.entity';

export enum TransactionInfoType {
  Creation = 'Creation',
  Custom = 'Custom',
  SettingsChange = 'SettingsChange',
  Transfer = 'Transfer',
  SwapOrder = 'SwapOrder',
  SwapTransfer = 'SwapTransfer',
  TwapOrder = 'TwapOrder',
  NativeStakingDeposit = 'NativeStakingDeposit',
  NativeStakingValidatorsExit = 'NativeStakingValidatorsExit',
  NativeStakingWithdraw = 'NativeStakingWithdraw',
}

export class TransactionInfo {
  @ApiProperty()
  type: TransactionInfoType;
  @ApiPropertyOptional({ type: String, nullable: true })
  humanDescription: string | null;
  @ApiPropertyOptional({ type: RichDecodedInfo, nullable: true })
  richDecodedInfo: RichDecodedInfo | null;

  protected constructor(
    type: TransactionInfoType,
    humanDescription: string | null,
    richDecodedInfo: RichDecodedInfo | null,
  ) {
    this.type = type;
    this.humanDescription = humanDescription;
    this.richDecodedInfo = richDecodedInfo;
  }
}
