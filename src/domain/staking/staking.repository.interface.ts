import type { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import type { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import type { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import type { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import type { DefiVaultStats } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import type { Stake } from '@/datasources/staking-api/entities/stake.entity';
import type { TransactionStatus } from '@/datasources/staking-api/entities/transaction-status.entity';
import type { DefiVaultStake } from '@/datasources/staking-api/entities/defi-vault-stake.entity';
import type { DefiMorphoExtraReward } from '@/datasources/staking-api/entities/defi-morpho-extra-reward.entity';
import type { RewardsFee } from '@/datasources/staking-api/entities/rewards-fee.entity';
import type { Address, Hash } from 'viem';

export const IStakingRepository = Symbol('IStakingRepository');
export const IStakingRepositoryWithRewardsFee = Symbol(
  'IStakingRepositoryWithRewardsFee',
);

export interface IStakingRepository {
  getDeployment(args: {
    chainId: string;
    address: Address;
  }): Promise<Deployment>;

  getNetworkStats(chainId: string): Promise<NetworkStats>;

  getDedicatedStakingStats(chainId: string): Promise<DedicatedStakingStats>;

  getPooledStakingStats(args: {
    chainId: string;
    pool: Address;
  }): Promise<PooledStakingStats>;

  getDefiVaultStats(args: {
    chainId: string;
    vault: Address;
  }): Promise<DefiVaultStats>;

  getDefiVaultStake(args: {
    chainId: string;
    safeAddress: Address;
    vault: Address;
  }): Promise<DefiVaultStake>;

  getDefiMorphoExtraRewards(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<DefiMorphoExtraReward>>;

  getStakes(args: {
    chainId: string;
    safeAddress: Address;
    validatorsPublicKeys: Array<Address>;
  }): Promise<Array<Stake>>;

  clearStakes(args: { chainId: string; safeAddress: Address }): Promise<void>;

  getTransactionStatus(args: {
    chainId: string;
    txHash: Hash;
  }): Promise<TransactionStatus>;

  clearApi(chainId: string): void;
}

export interface IStakingRepositoryWithRewardsFee extends IStakingRepository {
  getRewardsFee(args: {
    chainId: string;
    address: Address;
  }): Promise<RewardsFee>;
}
