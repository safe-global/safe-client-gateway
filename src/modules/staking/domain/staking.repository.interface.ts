import type { Deployment } from '@/modules/staking/datasources/entities/deployment.entity';
import type { DedicatedStakingStats } from '@/modules/staking/datasources/entities/dedicated-staking-stats.entity';
import type { NetworkStats } from '@/modules/staking/datasources/entities/network-stats.entity';
import type { PooledStakingStats } from '@/modules/staking/datasources/entities/pooled-staking-stats.entity';
import type { DefiVaultStats } from '@/modules/staking/datasources/entities/defi-vault-stats.entity';
import type { Stake } from '@/modules/staking/datasources/entities/stake.entity';
import type { TransactionStatus } from '@/modules/staking/datasources/entities/transaction-status.entity';
import type { DefiVaultStake } from '@/modules/staking/datasources/entities/defi-vault-stake.entity';
import type { DefiMorphoExtraReward } from '@/modules/staking/datasources/entities/defi-morpho-extra-reward.entity';
import type { RewardsFee } from '@/modules/staking/datasources/entities/rewards-fee.entity';
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
