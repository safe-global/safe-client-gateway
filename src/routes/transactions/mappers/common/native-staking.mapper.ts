import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import {
  ChainsRepositoryModule,
  IChainsRepository,
} from '@/domain/chains/chains.repository.interface';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { NativeStakingDepositTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-deposit-info.entity';
import { NativeStakingValidatorsExitTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-validators-exit-info.entity';
import {
  StakingStatus,
  StakingValidatorsExitStatus,
} from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { Inject, Injectable, Module, NotFoundException } from '@nestjs/common';

@Injectable()
export class NativeStakingMapper {
  private static readonly ETH_ETHERS_PER_VALIDATOR = 32;

  constructor(
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  /**
   * Maps the {@link NativeStakingDepositTransactionInfo} for the given
   * native staking deployment's `deposit` call
   *
   * @param args.chainId - the chain ID of the native staking deployment
   * @param args.to - the address of the native staking deployment
   * @param args.value - the value of the deposit transaction
   * @param args.isConfirmed - whether the deposit transaction is confirmed
   * @param args.depositExecutionDate - the date when the deposit transaction was executed
   *
   * @returns {@link NativeStakingDepositTransactionInfo} for the given native staking deployment
   */
  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
    value: string | null;
    isConfirmed: boolean;
    depositExecutionDate: Date | null;
  }): Promise<NativeStakingDepositTransactionInfo> {
    const [chain, deployment] = await Promise.all([
      this.chainsRepository.getChain(args.chainId),
      this.stakingRepository.getDeployment({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);

    if (
      deployment.product_type !== 'dedicated' ||
      deployment.chain === 'unknown' ||
      deployment.status === 'unknown'
    ) {
      throw new NotFoundException('Native staking deployment not found');
    }

    const [nativeStakingStats, networkStats] = await Promise.all([
      this.stakingRepository.getDedicatedStakingStats(args.chainId),
      this.stakingRepository.getNetworkStats(args.chainId),
    ]);

    const value = args.value ? Number(args.value) : 0;
    const numValidators = Math.floor(
      value /
        Math.pow(10, chain.nativeCurrency.decimals) /
        NativeStakingMapper.ETH_ETHERS_PER_VALIDATOR,
    );
    const fee = deployment.product_fee ? Number(deployment.product_fee) : 0;
    // NRR = GRR * (1 - service_fees)
    // Kiln also uses last_30d field, with product_fee
    const nrr = nativeStakingStats.gross_apy.last_30d * (1 - fee);
    const expectedAnnualReward = (nrr / 100) * value;
    const expectedMonthlyReward = expectedAnnualReward / 12;
    const expectedFiatAnnualReward =
      (expectedAnnualReward * (networkStats.eth_price_usd ?? 0)) /
      Math.pow(10, chain.nativeCurrency.decimals);
    const expectedFiatMonthlyReward = expectedFiatAnnualReward / 12;

    return new NativeStakingDepositTransactionInfo({
      status: this.mapDepositStatus(
        networkStats,
        args.isConfirmed,
        args.depositExecutionDate,
      ),
      estimatedEntryTime: networkStats.estimated_entry_time_seconds,
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
      fee,
      monthlyNrr: nrr / 12,
      annualNrr: nrr,
      value: getNumberString(value),
      numValidators,
      expectedAnnualReward: getNumberString(expectedAnnualReward),
      expectedMonthlyReward: getNumberString(expectedMonthlyReward),
      expectedFiatAnnualReward,
      expectedFiatMonthlyReward,
      // tokenInfo is set to the native currency of the chain for native staking deposits
      tokenInfo: new TokenInfo({
        address: NULL_ADDRESS,
        decimals: chain.nativeCurrency.decimals,
        logoUri: chain.nativeCurrency.logoUri,
        name: chain.nativeCurrency.name,
        symbol: chain.nativeCurrency.symbol,
        trusted: true,
      }),
    });
  }

  // TODO: refactor common logic between mapDepositInfo and mapValidatorsExitInfo
  public async mapValidatorsExitInfo(args: {
    chainId: string;
    to: `0x${string}`;
    value: string | null;
    transaction: MultisigTransaction | ModuleTransaction | null;
  }): Promise<NativeStakingValidatorsExitTransactionInfo> {
    const [chain, deployment] = await Promise.all([
      this.chainsRepository.getChain(args.chainId),
      this.stakingRepository.getDeployment({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);

    if (
      deployment.product_type !== 'dedicated' ||
      deployment.chain === 'unknown' ||
      deployment.status === 'unknown'
    ) {
      throw new NotFoundException('Native staking deployment not found');
    }

    const networkStats = await this.stakingRepository.getNetworkStats(
      args.chainId,
    );

    const value = args.transaction?.dataDecoded
      ? this.getValueFromDataDecoded(args.transaction.dataDecoded, chain)
      : Number(args.value ?? 0);

    const numValidators = Math.floor(
      value /
        Math.pow(10, chain.nativeCurrency.decimals) /
        NativeStakingMapper.ETH_ETHERS_PER_VALIDATOR,
    );

    return new NativeStakingValidatorsExitTransactionInfo({
      status: this.mapValidatorsExitStatus(networkStats, args.transaction),
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
      value: getNumberString(value),
      numValidators,
      tokenInfo: new TokenInfo({
        address: NULL_ADDRESS,
        decimals: chain.nativeCurrency.decimals,
        logoUri: chain.nativeCurrency.logoUri,
        name: chain.nativeCurrency.name,
        symbol: chain.nativeCurrency.symbol,
        trusted: true,
      }),
    });
  }

  /**
   * Maps the {@link StakingStatus} for the given native staking deployment's `deposit` call.
   * - If the deposit transaction is not confirmed, the status is `SignatureNeeded`.
   * - If the deposit transaction is confirmed but the deposit execution date is not available,
   * the status is `AwaitingExecution`.
   * - If the deposit execution date is available, the status is `AwaitingEntry` if the current
   * date is before the estimated entry time, otherwise the status is `ValidationStarted`.
   * - If the status cannot be determined, the status is `Unknown`.
   *
   * @param networkStats - the network stats for the chain where the native staking deployment lives
   * @param isConfirmed - whether the deposit transaction is confirmed
   * @param depositExecutionDate - the date when the deposit transaction was executed
   * @returns
   */
  private mapDepositStatus(
    networkStats: NetworkStats,
    isConfirmed: boolean,
    depositExecutionDate: Date | null,
  ): StakingStatus {
    if (!isConfirmed) {
      return StakingStatus.SignatureNeeded;
    }

    if (!depositExecutionDate) {
      return StakingStatus.AwaitingExecution;
    }

    const estimatedDepositEntryTime =
      depositExecutionDate.getTime() +
      networkStats.estimated_entry_time_seconds * 1000;

    return Date.now() <= estimatedDepositEntryTime
      ? StakingStatus.AwaitingEntry
      : StakingStatus.ValidationStarted;
  }

  private mapValidatorsExitStatus(
    networkStats: NetworkStats,
    transaction: MultisigTransaction | ModuleTransaction | null,
  ): StakingValidatorsExitStatus {
    const isConfirmed =
      transaction &&
      'confirmations' in transaction &&
      !!transaction.confirmations &&
      transaction.confirmations.length >= transaction.confirmationsRequired;

    if (!isConfirmed) {
      return StakingValidatorsExitStatus.SignatureNeeded;
    }

    if (!transaction.executionDate) {
      return StakingValidatorsExitStatus.AwaitingExecution;
    }

    // TODO: get validator status from the Kiln API
    const estimatedCompletionTime =
      transaction.executionDate.getTime() +
      networkStats.estimated_exit_time_seconds * 1000;

    return Date.now() <= estimatedCompletionTime
      ? StakingValidatorsExitStatus.RequestPending
      : StakingValidatorsExitStatus.ReadyToWithdraw;
  }
  /**
   * Gets the total value to withdraw from the native staking deployment
   * based on the amount of publicKey items in the transaction data.
   *
   * Each publicKey item represents a validator to withdraw, and each
   * native staking validator has a fixed amount of 32 ETH to withdraw.
   *
   * @param data - the decoded data of the transaction
   * @param chain - the chain where the native staking deployment lives
   * @returns the total value to withdraw from the native staking deployment
   */
  private getValueFromDataDecoded(data: DataDecoded, chain: Chain): number {
    if (data.method === 'requestValidatorsExit') {
      const publicKeys =
        data.parameters?.filter(
          (parameter) => parameter.name === '_publicKeys',
        ) ?? [];
      const decimals = chain.nativeCurrency.decimals;
      return (
        publicKeys.length *
        Math.pow(10, decimals) *
        NativeStakingMapper.ETH_ETHERS_PER_VALIDATOR
      );
    }

    return 0;
  }
}

@Module({
  imports: [StakingRepositoryModule, ChainsRepositoryModule],
  providers: [NativeStakingMapper],
  exports: [NativeStakingMapper],
})
export class NativeStakingMapperModule {}
