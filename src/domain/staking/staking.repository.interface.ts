import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { KilnStats } from '@/datasources/staking-api/entities/kiln-stats.entity';
import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { PooledStaking } from '@/datasources/staking-api/entities/pooled-staking.entity';

export const IStakingRepository = Symbol('IStakingRepository');

export interface IStakingRepository {
  getDeployments(chainId: string): Promise<Array<Deployment>>;

  getNetworkStats(chainId: string): Promise<NetworkStats>;

  getKilnStats(chainId: string): Promise<KilnStats>;

  getPooledStakingStats(args: {
    chainId: string;
    pool: `0x${string}`;
  }): Promise<PooledStaking>;

  clearApi(chainId: string): void;
}
