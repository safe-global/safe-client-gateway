import type { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import type { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import type { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import type { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import type { DefiVaultStats } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import type { Stake } from '@/datasources/staking-api/entities/stake.entity';
import type { TransactionStatus } from '@/datasources/staking-api/entities/transaction-status.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { DefiVaultStake } from '@/datasources/staking-api/entities/defi-vault-stake.entity';
import type { DefiMorphoExtraReward } from '@/datasources/staking-api/entities/defi-morpho-extra-reward.entity';
import type { RewardsFee } from '@/datasources/staking-api/entities/rewards-fee.entity';
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
