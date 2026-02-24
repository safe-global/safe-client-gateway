import { EarnApiManager } from '@/modules/earn/datasources/earn-api.manager';
import {
  type NetworkStats,
  NetworkStatsSchema,
} from '@/modules/staking/datasources/entities/network-stats.entity';
import {
  type PooledStakingStats,
  PooledStakingStatsSchema,
} from '@/modules/staking/datasources/entities/pooled-staking-stats.entity';
import { IStakingRepository } from '@/modules/staking/domain/staking.repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import {
  type DedicatedStakingStats,
  DedicatedStakingStatsSchema,
} from '@/modules/staking/datasources/entities/dedicated-staking-stats.entity';
import {
  type Deployment,
  DeploymentsSchema,
} from '@/modules/staking/datasources/entities/deployment.entity';
import {
  DefiVaultsStateSchema,
  type DefiVaultStats,
} from '@/modules/staking/datasources/entities/defi-vault-stats.entity';
import {
  type Stake,
  StakesSchema,
} from '@/modules/staking/datasources/entities/stake.entity';
import {
  type TransactionStatus,
  TransactionStatusSchema,
} from '@/modules/staking/datasources/entities/transaction-status.entity';
import {
  type DefiVaultStake,
  DefiVaultStakesSchema,
} from '@/modules/staking/datasources/entities/defi-vault-stake.entity';
import {
  type DefiMorphoExtraReward,
  DefiMorphoExtraRewardsSchema,
} from '@/modules/staking/datasources/entities/defi-morpho-extra-reward.entity';
import type { Address, Hash } from 'viem';

// TODO: Deduplicate code with StakingRepository

// Note: This mirrors that of StakingApiManager but as each widget deployment
// is its own Kiln "organization", deployments have different base URLs when
// compared to the staking API.

@Injectable()
export class EarnRepository implements IStakingRepository {
  constructor(
    @Inject(EarnApiManager)
    private readonly earnApiFactory: EarnApiManager,
  ) {}

  public async getDeployment(args: {
    chainId: string;
    address: Address;
  }): Promise<Deployment> {
    const deployments = await this.getDeployments(args.chainId);
    const deployment = deployments.find((deployment) => {
      return (
        args.chainId === deployment.chain_id.toString() &&
        args.address == deployment.address
      );
    });
    if (!deployment) {
      throw new Error('Deployment not found');
    }
    return deployment;
  }

  private async getDeployments(chainId: string): Promise<Array<Deployment>> {
    const earnApi = await this.earnApiFactory.getApi(chainId);
    const deployments = await earnApi.getDeployments();
    // TODO: Filter response by chainId and remove logic from validateDeployment
    return DeploymentsSchema.parse(deployments);
  }

  public async getNetworkStats(chainId: string): Promise<NetworkStats> {
    const earnApi = await this.earnApiFactory.getApi(chainId);
    const networkStats = await earnApi.getNetworkStats();
    return NetworkStatsSchema.parse(networkStats);
  }

  public async getDedicatedStakingStats(
    chainId: string,
  ): Promise<DedicatedStakingStats> {
    const earnApi = await this.earnApiFactory.getApi(chainId);
    const dedicatedStakingStats = await earnApi.getDedicatedStakingStats();
    return DedicatedStakingStatsSchema.parse(dedicatedStakingStats);
  }

  public async getPooledStakingStats(args: {
    chainId: string;
    pool: Address;
  }): Promise<PooledStakingStats> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const pooledStaking = await earnApi.getPooledStakingStats(args.pool);
    return PooledStakingStatsSchema.parse(pooledStaking);
  }

  public async getDefiVaultStats(args: {
    chainId: string;
    vault: Address;
  }): Promise<DefiVaultStats> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const defiStats = await earnApi.getDefiVaultStats(args.vault);
    // Cannot be >1 contract deployed at the same address so return first element
    return DefiVaultsStateSchema.parse(defiStats)[0];
  }

  public async getDefiVaultStake(args: {
    chainId: string;
    safeAddress: Address;
    vault: Address;
  }): Promise<DefiVaultStake> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const defiStakes = await earnApi.getDefiVaultStakes(args);
    // Safe can only have one stake per Vault so return first element
    return DefiVaultStakesSchema.parse(defiStakes)[0];
  }

  public async getDefiMorphoExtraRewards(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<DefiMorphoExtraReward>> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const defiMorphoExtraRewards = await earnApi.getDefiMorphoExtraRewards(
      args.safeAddress,
    );
    return DefiMorphoExtraRewardsSchema.parse(defiMorphoExtraRewards);
  }

  public async getStakes(args: {
    chainId: string;
    safeAddress: Address;
    validatorsPublicKeys: Array<Address>;
  }): Promise<Array<Stake>> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const stakes = await earnApi.getStakes(args);
    return StakesSchema.parse(stakes);
  }

  public async clearStakes(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    await earnApi.clearStakes(args.safeAddress);
  }

  public async getTransactionStatus(args: {
    chainId: string;
    txHash: Hash;
  }): Promise<TransactionStatus> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const txStatus = await earnApi.getTransactionStatus(args.txHash);
    return TransactionStatusSchema.parse(txStatus);
  }

  public clearApi(chainId: string): void {
    this.earnApiFactory.destroyApi(chainId);
  }
}
