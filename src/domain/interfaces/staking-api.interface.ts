import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import { DefiVaultStats } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import { Stake } from '@/datasources/staking-api/entities/stake.entity';

export const IStakingApi = Symbol('IStakingApi');

export interface IStakingApi {
  getDeployments(): Promise<Array<Deployment>>;

  getNetworkStats(): Promise<NetworkStats>;

  getDedicatedStakingStats(): Promise<DedicatedStakingStats>;

  getPooledStakingStats(pool: `0x${string}`): Promise<PooledStakingStats>;

  getDefiVaultStats(args: {
    chainId: string;
    vault: `0x${string}`;
  }): Promise<Array<DefiVaultStats>>;

  getStakes(validatorsPublicKeys: Array<`0x${string}`>): Promise<Stake[]>;
}
