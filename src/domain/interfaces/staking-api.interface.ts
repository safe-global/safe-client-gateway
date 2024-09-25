import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import { DefiVaultStats } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import { Stake } from '@/datasources/staking-api/entities/stake.entity';
import { TransactionStatus } from '@/datasources/staking-api/entities/transaction-status.entity';

export const IStakingApi = Symbol('IStakingApi');

export interface IStakingApi {
  getDeployments(): Promise<Array<Deployment>>;

  getNetworkStats(): Promise<NetworkStats>;

  getDedicatedStakingStats(): Promise<DedicatedStakingStats>;

  getPooledStakingStats(pool: `0x${string}`): Promise<PooledStakingStats>;

  getDefiVaultStats(vault: `0x${string}`): Promise<Array<DefiVaultStats>>;

  getStakes(args: {
    safeAddress: `0x${string}`;
    validatorsPublicKeys: Array<`0x${string}`>;
  }): Promise<Stake[]>;

  clearStakes(safeAddress: `0x${string}`): Promise<void>;

  getTransactionStatus(txHash: `0x${string}`): Promise<TransactionStatus>;
}
