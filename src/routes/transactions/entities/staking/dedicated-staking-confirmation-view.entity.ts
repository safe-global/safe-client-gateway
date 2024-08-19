import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  ConfirmationViewDecodedType,
  IBaselineConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { NativeStakingDepositInfo } from '@/routes/transactions/entities/staking/dedicated-staking-info.entity';

export class NativeStakingDepositConfirmationView
  implements IBaselineConfirmationView, NativeStakingDepositInfo
{
  @ApiProperty({
    enum: [ConfirmationViewDecodedType.KilnNativeStakingDeposit],
  })
  type = ConfirmationViewDecodedType.KilnNativeStakingDeposit;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  @ApiProperty()
  estimatedEntryTime: number;

  @ApiProperty()
  estimatedExitTime: number;

  @ApiProperty()
  estimatedWithdrawalTime: number;

  @ApiProperty()
  fee: number;

  @ApiProperty()
  monthlyNrr: number;

  @ApiProperty()
  annualNrr: number;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
  }
}
