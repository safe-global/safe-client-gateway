import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import { NativeStakingDepositTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-info.entity';
import { StakingStatus } from '@/routes/transactions/entities/staking/staking.entity';
import { Inject, Injectable, Module, NotFoundException } from '@nestjs/common';

@Injectable()
export class NativeStakingMapper {
  constructor(
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
  ) {}

  /**
   * Maps the {@link NativeStakingDepositTransactionInfo} for the given
   * native staking deployment's `deposit` call
   *
   * @param args.chainId - the chain ID of the native staking deployment
   * @param args.to - the address of the native staking deployment
   * @param args.isConfirmed - whether the deposit transaction is confirmed
   * @param args.depositExecutionDate - the date when the deposit transaction was executed
   *
   * @returns {@link NativeStakingDepositTransactionInfo} for the given native staking deployment
   */
  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
    isConfirmed: boolean;
    depositExecutionDate: Date | null;
  }): Promise<NativeStakingDepositTransactionInfo> {
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

    const fee = deployment.product_fee ? Number(deployment.product_fee) : 0;
    // NRR = GRR * (1 - service_fees)
    // Kiln also uses last_30d field, with product_fee
    const nrr = nativeStakingStats.gross_apy.last_30d * (1 - fee);

    return new NativeStakingDepositTransactionInfo({
      status: this.mapStatus(
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
    });
  }

  /**
   * Maps the {@link StakingStatus} for the given native staking deployment's `deposit` call.
   * - If the deposit transaction is not confirmed, the status is `SignatureNeeded`.
   * - If the deposit transaction is confirmed but the deposit execution date is not available,
   * the status is `AwaitingEntry`.
   * - If the deposit execution date is available, the status is `AwaitingEntry` if the current
   * date is before the estimated entry time, otherwise the status is `Validating`.
   * - If the status cannot be determined, the status is `Unknown`.
   *
   * @param networkStats - the network stats for the chain where the native staking deployment lives
   * @param isConfirmed - whether the deposit transaction is confirmed
   * @param depositExecutionDate - the date when the deposit transaction was executed
   * @returns
   */
  private mapStatus(
    networkStats: NetworkStats,
    isConfirmed: boolean,
    depositExecutionDate: Date | null,
  ): StakingStatus {
    if (!isConfirmed) {
      return StakingStatus.SignatureNeeded;
    }

    if (!depositExecutionDate) {
      return StakingStatus.AwaitingEntry;
    }

    const estimatedDepositEntryTime =
      depositExecutionDate.getTime() +
      networkStats.estimated_entry_time_seconds * 1000;

    return Date.now() <= estimatedDepositEntryTime
      ? StakingStatus.AwaitingEntry
      : StakingStatus.Validating;
  }
}

@Module({
  imports: [StakingRepositoryModule],
  providers: [NativeStakingMapper],
  exports: [NativeStakingMapper],
})
export class NativeStakingMapperModule {}
