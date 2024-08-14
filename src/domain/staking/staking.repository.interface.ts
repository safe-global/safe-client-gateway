import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import { DefiVaultStats } from '@/datasources/staking-api/entities/defi-vault-stats.entity';

export const IStakingRepository = Symbol('IStakingRepository');

export interface IStakingRepository {
  getDeployments(chainId: string): Promise<Array<Deployment>>;

  getNetworkStats(chainId: string): Promise<NetworkStats>;

  getDedicatedStakingStats(chainId: string): Promise<DedicatedStakingStats>;

  getPooledStakingStats(args: {
    chainId: string;
    pool: `0x${string}`;
  }): Promise<PooledStakingStats>;

  getDefiVaultStats(args: {
    chainId: string;
    vault: `0x${string}`;
  }): Promise<Array<DefiVaultStats>>;

  clearApi(chainId: string): void;
}
