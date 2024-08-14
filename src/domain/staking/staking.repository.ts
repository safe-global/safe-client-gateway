import { IStakingApiManager } from '@/domain/interfaces/staking-api.manager.interface';
import {
  NetworkStats,
  NetworkStatsSchema,
} from '@/datasources/staking-api/entities/network-stats.entity';
import {
  PooledStaking,
  PooledStakingSchema,
} from '@/datasources/staking-api/entities/pooled-staking.entity';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import {
  KilnStats,
  KilnStatsSchema,
} from '@/datasources/staking-api/entities/kiln-stats.entity';
import {
  Deployment,
  DeploymentSchema,
} from '@/datasources/staking-api/entities/deployment.entity';

@Injectable()
export class StakingRepository implements IStakingRepository {
  constructor(
    @Inject(IStakingApiManager)
    private readonly stakingApiFactory: IStakingApiManager,
  ) {}

  public async getDeployments(chainId: string): Promise<Array<Deployment>> {
    const stakingApi = await this.stakingApiFactory.getApi(chainId);
    const deployments = await stakingApi.getDeployments();
    return deployments.map((deployment) => DeploymentSchema.parse(deployment));
  }

  public async getNetworkStats(chainId: string): Promise<NetworkStats> {
    const stakingApi = await this.stakingApiFactory.getApi(chainId);
    const networkStats = await stakingApi.getNetworkStats();
    return NetworkStatsSchema.parse(networkStats);
  }

  public async getKilnStats(chainId: string): Promise<KilnStats> {
    const stakingApi = await this.stakingApiFactory.getApi(chainId);
    const kilnStats = await stakingApi.getKilnStats();
    return KilnStatsSchema.parse(kilnStats);
  }

  public async getPooledStakingStats(args: {
    chainId: string;
    pool: `0x${string}`;
  }): Promise<PooledStaking> {
    const stakingApi = await this.stakingApiFactory.getApi(args.chainId);
    const pooledStaking = await stakingApi.getPooledStakingStats(args.pool);
    return PooledStakingSchema.parse(pooledStaking);
  }

  public clearApi(chainId: string): void {
    this.stakingApiFactory.destroyApi(chainId);
  }
}
