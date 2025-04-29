import type { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import type { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import type { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import type { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import type { DefiVaultStats } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import type { Stake } from '@/datasources/staking-api/entities/stake.entity';
import type { TransactionStatus } from '@/datasources/staking-api/entities/transaction-status.entity';
import type { DefiVaultStake } from '@/datasources/staking-api/entities/defi-vault-stake.entity';
import type { DefiMorphoExtraReward } from '@/datasources/staking-api/entities/defi-morpho-extra-reward.entity';

export const IStakingRepository = Symbol('IStakingRepository');

export interface IStakingRepository {
  getDeployment(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<Deployment>;

  getNetworkStats(chainId: string): Promise<NetworkStats>;

  getDedicatedStakingStats(chainId: string): Promise<DedicatedStakingStats>;

  getPooledStakingStats(args: {
    chainId: string;
    pool: `0x${string}`;
  }): Promise<PooledStakingStats>;

  getDefiVaultStats(args: {
    chainId: string;
    vault: `0x${string}`;
  }): Promise<DefiVaultStats>;

  getDefiVaultStake(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    vault: `0x${string}`;
  }): Promise<DefiVaultStake>;

  getDefiMorphoExtraRewards(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<DefiMorphoExtraReward>>;

  getStakes(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    validatorsPublicKeys: Array<`0x${string}`>;
  }): Promise<Array<Stake>>;

  clearStakes(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  getTransactionStatus(args: {
    chainId: string;
    txHash: `0x${string}`;
  }): Promise<TransactionStatus>;

  clearApi(chainId: string): void;
}
