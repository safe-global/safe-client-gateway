import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiProperty({ enum: TransactionInfoType })
  type: TransactionInfoType;
  @ApiPropertyOptional({ type: String, nullable: true })
  humanDescription: string | null;

  protected constructor(
    type: TransactionInfoType,
    humanDescription: string | null,
  ) {
    this.type = type;
    this.humanDescription = humanDescription;
  }
}
