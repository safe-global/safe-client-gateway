import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import { NativeStakingDepositTransactionInfo } from '@/routes/transactions/entities/staking/dedicated-staking-info.entity';
import { Inject, Injectable, Module, NotFoundException } from '@nestjs/common';

@Injectable()
export class NativeStakingMapper {
  constructor(
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
  ) {}

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
      deployment.chain === 'unknown'
    ) {
      throw new NotFoundException('Staking deployment not found');
    }

    const [nativeStakingStats, networkStats] = await Promise.all([
      this.stakingRepository.getDedicatedStakingStats(args.chainId),
      this.stakingRepository.getNetworkStats(args.chainId),
    ]);

    const fee = deployment.product_fee ? Number(deployment.product_fee) : 0;
    const nrr = nativeStakingStats.gross_apy.last_30d * (1 - fee);

    return new NativeStakingDepositTransactionInfo({
      estimatedEntryTime: networkStats.estimated_entry_time_seconds,
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
      fee,
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
