import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/routes/transactions/helpers/transaction-finder.helper';
import { Inject, Injectable, Module } from '@nestjs/common';
import { toFunctionSelector } from 'viem';

@Injectable()
export class KilnNativeStakingHelper {
  constructor(
    private readonly transactionFinder: TransactionFinder,
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
  ) {}

  public async findDeposit(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    const selector = toFunctionSelector('function deposit() external payable');
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );

    if (!transaction?.to) {
      return null;
    }

    // We need to check against the deployment as `deposit` is a common function name
    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: transaction.to,
      })
      .catch(() => null);

    if (deployment?.product_type !== 'dedicated') {
      return null;
    }

    return {
      to: transaction.to,
      data: transaction.data,
    };
  }

  // TODO: refactor this and the above function to a single function
  public async findValidatorsExit(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    const selector = toFunctionSelector(
      'function requestValidatorsExit(bytes) external',
    );
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );

    if (!transaction?.to) {
      return null;
    }

    // We need to check against the deployment as `deposit` is a common function name
    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: transaction.to,
      })
      .catch(() => null);

    if (deployment?.product_type !== 'dedicated') {
      return null;
    }

    return {
      to: transaction.to,
      data: transaction.data,
    };
  }

  public async findWithdraw(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    const selector = toFunctionSelector(
      'function batchWithdrawCLFee(bytes) external',
    );
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );

    if (!transaction?.to) {
      return null;
    }

    // We need to check against the deployment as `deposit` is a common function name
    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: transaction.to,
      })
      .catch(() => null);

    if (deployment?.product_type !== 'dedicated') {
      return null;
    }

    return {
      to: transaction.to,
      data: transaction.data,
    };
  }
}

@Module({
  imports: [TransactionFinderModule, StakingRepositoryModule],
  providers: [KilnNativeStakingHelper],
  exports: [KilnNativeStakingHelper],
})
export class KilnNativeStakingHelperModule {}
