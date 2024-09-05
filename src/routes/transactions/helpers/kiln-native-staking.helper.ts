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
    return this.findTransactionAndCheckDeployment({
      ...args,
      selector: toFunctionSelector('function deposit() external payable'),
    });
  }

  public async findValidatorsExit(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    return this.findTransactionAndCheckDeployment({
      ...args,
      selector: toFunctionSelector(
        'function requestValidatorsExit(bytes) external',
      ),
    });
  }

  public async findWithdraw(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    return this.findTransactionAndCheckDeployment({
      ...args,
      selector: toFunctionSelector(
        'function batchWithdrawCLFee(bytes) external',
      ),
    });
  }

  /**
   * Check the transaction and the deployment to see if it is a valid staking transaction.
   * We need to check against the deployment as some function signatures have common function names, e.g. deposit.
   */
  private async findTransactionAndCheckDeployment(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
    selector: string;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(args.selector),
      args,
    );

    if (!transaction?.to) {
      return null;
    }

    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: transaction.to,
      })
      .catch(() => null);

    if (
      deployment?.product_type !== 'dedicated' &&
      deployment?.chain !== 'unknown'
    ) {
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
