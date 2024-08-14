import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { KilnStats } from '@/datasources/staking-api/entities/kiln-stats.entity';
import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { PooledStaking } from '@/datasources/staking-api/entities/pooled-staking.entity';

export const IStakingApi = Symbol('IStakingApi');

export interface IStakingApi {
  getDeployments(): Promise<Array<Deployment>>;

  getNetworkStats(): Promise<NetworkStats>;

  getKilnStats(): Promise<KilnStats>;

  getPooledStakingStats(pool: `0x${string}`): Promise<PooledStaking>;
}
