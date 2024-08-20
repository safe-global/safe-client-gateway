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
   *
   * @returns {@link NativeStakingDepositTransactionInfo} for the given native staking deployment
   */
  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
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
      // TODO: Implement once confirmed with design
      status: StakingStatus.Unknown,
      estimatedEntryTime: networkStats.estimated_entry_time_seconds,
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
      fee,
      // For uniform data structure, we have monthly/annual but we use the same value
      monthlyNrr: nrr,
      annualNrr: nrr,
    });
  }
}

@Module({
  imports: [StakingRepositoryModule],
  providers: [NativeStakingMapper],
  exports: [NativeStakingMapper],
})
export class NativeStakingMapperModule {}
