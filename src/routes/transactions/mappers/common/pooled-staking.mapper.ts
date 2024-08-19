import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  PooledStakingDepositTransactionInfo,
  PooledStakingWithdrawTransactionInfo,
  PooledStakingRequestExitTransactionInfo,
} from '@/routes/transactions/entities/staking/pooled-staking-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  KilnPooledStakingHelper,
  KilnPooledStakingHelperModule,
} from '@/routes/transactions/helpers/kiln-pooled-staking.helper';
import { Inject, Injectable, Module, NotFoundException } from '@nestjs/common';

@Injectable()
export class PooledStakingMapper {
  constructor(
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    private readonly pooledStakingHelper: KilnPooledStakingHelper,
  ) {}

  public async mapStakeInfo(args: {
    chainId: string;
    to: `0x${string}`;
  }): Promise<PooledStakingDepositTransactionInfo> {
    const [baseInfo, pooledStakingStats] = await Promise.all([
      this.getBasePooledStakingInfo(args),
      this.stakingRepository.getPooledStakingStats({
        chainId: args.chainId,
        pool: args.to,
      }),
    ]);

    return new PooledStakingDepositTransactionInfo({
      fee: pooledStakingStats.fee,
      monthlyNrr: pooledStakingStats.one_month.nrr,
      annualNrr: pooledStakingStats.one_year.nrr,
      ...baseInfo,
    });
  }

  public async mapRequestExitInfo(args: {
    chainId: string;
    to: `0x${string}`;
  }): Promise<PooledStakingRequestExitTransactionInfo> {
    const baseInfo = await this.getBasePooledStakingInfo(args);
    return new PooledStakingRequestExitTransactionInfo(baseInfo);
  }

  public async mapWithdrawInfo(args: {
    chainId: string;
    to: `0x${string}`;
  }): Promise<PooledStakingWithdrawTransactionInfo> {
    const baseInfo = await this.getBasePooledStakingInfo(args);
    return new PooledStakingWithdrawTransactionInfo(baseInfo);
  }

  private async getBasePooledStakingInfo(args: {
    chainId: string;
    to: `0x${string}`;
  }): Promise<{
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    pool: AddressInfo;
    poolToken: TokenInfo;
    exchangeRate: string;
  }> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (
      deployment.product_type !== 'pooling' ||
      deployment.chain === 'unknown'
    ) {
      throw new NotFoundException('Staking pool not found');
    }

    const [networkStats, exchangeRate, poolToken] = await Promise.all([
      this.stakingRepository.getNetworkStats(args.chainId),
      this.pooledStakingHelper.getRate({
        chainId: args.chainId,
        pool: args.to,
      }),
      this.pooledStakingHelper.getPoolToken({
        chainId: args.chainId,
        pool: args.to,
      }),
    ]);

    return {
      estimatedEntryTime: networkStats.estimated_entry_time_seconds,
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
      pool: new AddressInfo(deployment.address, deployment.display_name),
      poolToken,
      exchangeRate: exchangeRate.toString(),
    };
  }
}

@Module({
  imports: [StakingRepositoryModule, KilnPooledStakingHelperModule],
  providers: [PooledStakingMapper],
  exports: [PooledStakingMapper],
})
export class PooledStakingMapperModule {}
