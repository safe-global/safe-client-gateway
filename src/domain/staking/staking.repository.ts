import { IStakingApiManager } from '@/domain/interfaces/staking-api.manager.interface';
import {
  NetworkStats,
  NetworkStatsSchema,
} from '@/datasources/staking-api/entities/network-stats.entity';
import {
  PooledStakingStats,
  PooledStakingStatsSchema,
} from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import { IStakingRepositoryWithRewardsFee } from '@/domain/staking/staking.repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import {
  DedicatedStakingStats,
  DedicatedStakingStatsSchema,
} from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import {
  Deployment,
  DeploymentsSchema,
} from '@/datasources/staking-api/entities/deployment.entity';
import {
  DefiVaultsStateSchema,
  DefiVaultStats,
} from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import {
  Stake,
  StakesSchema,
} from '@/datasources/staking-api/entities/stake.entity';
import {
  TransactionStatus,
  TransactionStatusSchema,
} from '@/datasources/staking-api/entities/transaction-status.entity';
import {
  DefiVaultStake,
  DefiVaultStakesSchema,
} from '@/datasources/staking-api/entities/defi-vault-stake.entity';
import {
  DefiMorphoExtraReward,
  DefiMorphoExtraRewardsSchema,
} from '@/datasources/staking-api/entities/defi-morpho-extra-reward.entity';
import {
  RewardsFee,
  RewardsFeeSchema,
} from '@/datasources/staking-api/entities/rewards-fee.entity';

// TODO: Deduplicate code with EarnRepository

@Injectable()
export class StakingRepository implements IStakingRepositoryWithRewardsFee {
  constructor(
    @Inject(IStakingApiManager)
    private readonly stakingApiFactory: IStakingApiManager,
  ) {}

  public async getDeployment(args: {
    chainId: string;
    address: `0x${string}`;
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

  public async getRewardsFee(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<RewardsFee> {
    const stakingApi = await this.stakingApiFactory.getApi(args.chainId);
    const rewardsFee = await stakingApi.getRewardsFee(args.address);
    return RewardsFeeSchema.parse(rewardsFee);
  }

  private async getDeployments(chainId: string): Promise<Array<Deployment>> {
    const stakingApi = await this.stakingApiFactory.getApi(chainId);
    const deployments = await stakingApi.getDeployments();
    // TODO: Filter response by chainId and remove logic from validateDeployment
    return DeploymentsSchema.parse(deployments);
  }

  public async getNetworkStats(chainId: string): Promise<NetworkStats> {
    const stakingApi = await this.stakingApiFactory.getApi(chainId);
    const networkStats = await stakingApi.getNetworkStats();
    return NetworkStatsSchema.parse(networkStats);
  }

  public async getDedicatedStakingStats(
    chainId: string,
  ): Promise<DedicatedStakingStats> {
    const stakingApi = await this.stakingApiFactory.getApi(chainId);
    const dedicatedStakingStats = await stakingApi.getDedicatedStakingStats();
    return DedicatedStakingStatsSchema.parse(dedicatedStakingStats);
  }

  public async getPooledStakingStats(args: {
    chainId: string;
    pool: `0x${string}`;
  }): Promise<PooledStakingStats> {
    const stakingApi = await this.stakingApiFactory.getApi(args.chainId);
    const pooledStaking = await stakingApi.getPooledStakingStats(args.pool);
    return PooledStakingStatsSchema.parse(pooledStaking);
  }

  public async getDefiVaultStats(args: {
    chainId: string;
    vault: `0x${string}`;
  }): Promise<DefiVaultStats> {
    const stakingApi = await this.stakingApiFactory.getApi(args.chainId);
    const defiStats = await stakingApi.getDefiVaultStats(args.vault);
    // Cannot be >1 contract deployed at the same address so return first element
    return DefiVaultsStateSchema.parse(defiStats)[0];
  }

  public async getDefiVaultStake(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    vault: `0x${string}`;
  }): Promise<DefiVaultStake> {
    const stakingApi = await this.stakingApiFactory.getApi(args.chainId);
    const defiStakes = await stakingApi.getDefiVaultStakes(args);
    // Safe can only have one stake per Vault so return first element
    return DefiVaultStakesSchema.parse(defiStakes)[0];
  }

  public async getDefiMorphoExtraRewards(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<DefiMorphoExtraReward>> {
    const stakingApi = await this.stakingApiFactory.getApi(args.chainId);
    const defiMorphoExtraRewards = await stakingApi.getDefiMorphoExtraRewards(
      args.safeAddress,
    );
    return DefiMorphoExtraRewardsSchema.parse(defiMorphoExtraRewards);
  }

  public async getStakes(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    validatorsPublicKeys: Array<`0x${string}`>;
  }): Promise<Array<Stake>> {
    const stakingApi = await this.stakingApiFactory.getApi(args.chainId);
    const stakes = await stakingApi.getStakes(args);
    return StakesSchema.parse(stakes);
  }

  public async clearStakes(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const stakingApi = await this.stakingApiFactory.getApi(args.chainId);
    await stakingApi.clearStakes(args.safeAddress);
  }

  public async getTransactionStatus(args: {
    chainId: string;
    txHash: `0x${string}`;
  }): Promise<TransactionStatus> {
    const stakingApi = await this.stakingApiFactory.getApi(args.chainId);
    const txStatus = await stakingApi.getTransactionStatus(args.txHash);
    return TransactionStatusSchema.parse(txStatus);
  }

  public clearApi(chainId: string): void {
    this.stakingApiFactory.destroyApi(chainId);
  }
}
