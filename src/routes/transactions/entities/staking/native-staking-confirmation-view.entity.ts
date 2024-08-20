import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  Baseline,
  DecodedType,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { NativeStakingDepositInfo } from '@/routes/transactions/entities/staking/native-staking-info.entity';
import { StakingStatus } from '@/routes/transactions/entities/staking/staking.entity';

export class NativeStakingDepositConfirmationView
  implements Baseline, NativeStakingDepositInfo
{
  @ApiProperty({
    enum: [DecodedType.KilnNativeStakingDeposit],
  })
  type = DecodedType.KilnNativeStakingDeposit;

  @ApiProperty({
    enum: StakingStatus,
  })
  status: StakingStatus;

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
    status: StakingStatus;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.status = args.status;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
  }
}
