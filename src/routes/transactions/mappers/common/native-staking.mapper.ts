import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import {
  ChainsRepositoryModule,
  IChainsRepository,
} from '@/domain/chains/chains.repository.interface';
import { getNumberString } from '@/domain/common/utils/utils';
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
    const chain = await this.chainsRepository.getChain(args.chainId);
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

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
    isConfirmed: boolean;
    validatorsExitExecutionDate: Date | null;
  }): Promise<NativeStakingValidatorsExitTransactionInfo> {
    const chain = await this.chainsRepository.getChain(args.chainId);
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

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

    // TODO: value from dataDecoded?
    const value = args.value ? Number(args.value) : 0;
    const numValidators = Math.floor(
      value /
        Math.pow(10, chain.nativeCurrency.decimals) /
        NativeStakingMapper.ETH_ETHERS_PER_VALIDATOR,
    );

    return new NativeStakingValidatorsExitTransactionInfo({
      status: this.mapValidatorsExitStatus(
        networkStats,
        args.isConfirmed,
        args.validatorsExitExecutionDate,
      ),
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
    isConfirmed: boolean,
    validatorsExitExecutionDate: Date | null,
  ): StakingValidatorsExitStatus {
    if (!isConfirmed) {
      return StakingValidatorsExitStatus.SignatureNeeded;
    }

    if (!validatorsExitExecutionDate) {
      return StakingValidatorsExitStatus.AwaitingExecution;
    }

    // TODO: get validator status from the Kiln API
    const estimatedCompletionTime =
      validatorsExitExecutionDate.getTime() +
      networkStats.estimated_exit_time_seconds * 1000;

    return Date.now() <= estimatedCompletionTime
      ? StakingValidatorsExitStatus.RequestPending
      : StakingValidatorsExitStatus.ReadyToWithdraw;
  }
}

@Module({
  imports: [StakingRepositoryModule, ChainsRepositoryModule],
  providers: [NativeStakingMapper],
  exports: [NativeStakingMapper],
})
export class NativeStakingMapperModule {}
