import type { Deployment } from '@/modules/staking/datasources/entities/deployment.entity';
import type { DedicatedStakingStats } from '@/modules/staking/datasources/entities/dedicated-staking-stats.entity';
import type { NetworkStats } from '@/modules/staking/datasources/entities/network-stats.entity';
import type { PooledStakingStats } from '@/modules/staking/datasources/entities/pooled-staking-stats.entity';
import type { DefiVaultStats } from '@/modules/staking/datasources/entities/defi-vault-stats.entity';
import type { Stake } from '@/modules/staking/datasources/entities/stake.entity';
import type { TransactionStatus } from '@/modules/staking/datasources/entities/transaction-status.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { DefiVaultStake } from '@/modules/staking/datasources/entities/defi-vault-stake.entity';
import type { DefiMorphoExtraReward } from '@/modules/staking/datasources/entities/defi-morpho-extra-reward.entity';
import type { RewardsFee } from '@/modules/staking/datasources/entities/rewards-fee.entity';
import type { Address, Hash } from 'viem';

export const IStakingApi = Symbol('IStakingApi');

export interface IStakingApi {
  getDeployments(): Promise<Raw<Array<Deployment>>>;

  getRewardsFee(contract: Address): Promise<Raw<RewardsFee>>;

  getNetworkStats(): Promise<Raw<NetworkStats>>;

  getDedicatedStakingStats(): Promise<Raw<DedicatedStakingStats>>;

  getPooledStakingStats(pool: Address): Promise<Raw<PooledStakingStats>>;

  getDefiVaultStats(vault: Address): Promise<Raw<Array<DefiVaultStats>>>;

  getDefiVaultStakes(args: {
    safeAddress: Address;
    vault: Address;
  }): Promise<Raw<Array<DefiVaultStake>>>;

  getDefiMorphoExtraRewards(
    safeAddress: Address,
  ): Promise<Raw<Array<DefiMorphoExtraReward>>>;

  getStakes(args: {
    safeAddress: Address;
    validatorsPublicKeys: Array<Address>;
  }): Promise<Raw<Array<Stake>>>;

  clearStakes(safeAddress: Address): Promise<void>;

  getTransactionStatus(txHash: Hash): Promise<Raw<TransactionStatus>>;
}
