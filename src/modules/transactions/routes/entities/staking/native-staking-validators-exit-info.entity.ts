import { StakingStatus } from '@/modules/transactions/routes/entities/staking/staking.entity';
import { TokenInfo } from '@/modules/transactions/routes/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/modules/transactions/routes/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export class NativeStakingValidatorsExitTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.NativeStakingValidatorsExit] })
  override type = TransactionInfoType.NativeStakingValidatorsExit;

  @ApiProperty({ enum: StakingStatus })
  status: StakingStatus;

  @ApiProperty()
  estimatedExitTime: number;

  @ApiProperty()
  estimatedWithdrawalTime: number;

  @ApiProperty()
  value: string;

  @ApiProperty()
  numValidators: number;

  @ApiProperty()
  tokenInfo: TokenInfo;

  @ApiProperty()
  validators: Array<Address>;

  constructor(args: {
    status: StakingStatus;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    value: string;
    numValidators: number;
    tokenInfo: TokenInfo;
    validators: Array<Address>;
  }) {
    super(TransactionInfoType.NativeStakingValidatorsExit, null);
    this.status = args.status;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.value = args.value;
    this.numValidators = args.numValidators;
    this.tokenInfo = args.tokenInfo;
    this.validators = args.validators;
  }
}
