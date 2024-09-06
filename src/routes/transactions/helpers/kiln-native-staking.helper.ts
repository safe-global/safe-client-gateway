import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/routes/transactions/helpers/transaction-finder.helper';
import { Inject, Injectable, Module } from '@nestjs/common';
import { toFunctionSelector } from 'viem';

type NativeStakingTransaction = 'deposit' | 'validatorsExit' | 'withdraw';

@Injectable()
export class KilnNativeStakingHelper {
  private static readonly SIGNATURES: Record<NativeStakingTransaction, string> =
    {
      deposit: 'function deposit() external payable',
      validatorsExit: 'function requestValidatorsExit(bytes) external',
      withdraw: 'function batchWithdrawCLFee(bytes) external',
    };

  constructor(
    private readonly transactionFinder: TransactionFinder,
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
  ) {}

  public async findTransaction(
    type: NativeStakingTransaction,
    args: { chainId: string; to?: `0x${string}`; data: `0x${string}` },
  ): Promise<{ to: `0x${string}`; data: `0x${string}` } | null> {
    const signature = KilnNativeStakingHelper.SIGNATURES[type];
    const transaction = this.transactionFinder.findTransaction(
      (transaction) =>
        transaction.data.startsWith(toFunctionSelector(signature)),
      args,
    );

    if (!transaction?.to) {
      return null;
    }
    return this.checkDeployment({
      chainId: args.chainId,
      transaction: { to: transaction.to, data: transaction.data },
    });
  }

  /**
   * Check the deployment to see if it is a valid staking transaction.
   * We need to check against the deployment as some function signatures have common function names, e.g. deposit.
   */
  private async checkDeployment(args: {
    chainId: string;
    transaction: { to: `0x${string}`; data: `0x${string}` };
  }): Promise<{ to: `0x${string}`; data: `0x${string}` } | null> {
    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: args.transaction.to,
      })
      .catch(() => null);

    if (
      deployment?.product_type !== 'dedicated' &&
      deployment?.chain !== 'unknown'
    ) {
      return null;
    }

    return {
      to: args.transaction.to,
      data: args.transaction.data,
    };
  }
}

@Module({
  imports: [TransactionFinderModule, StakingRepositoryModule],
  providers: [KilnNativeStakingHelper],
  exports: [KilnNativeStakingHelper],
})
export class KilnNativeStakingHelperModule {}
