import { EarnApiManager } from '@/datasources/earn-api/earn-api.manager';
import {
  NetworkStats,
  NetworkStatsSchema,
} from '@/datasources/staking-api/entities/network-stats.entity';
import {
  PooledStakingStats,
  PooledStakingStatsSchema,
} from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
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
    pool: `0x${string}`;
  }): Promise<PooledStakingStats> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const pooledStaking = await earnApi.getPooledStakingStats(args.pool);
    return PooledStakingStatsSchema.parse(pooledStaking);
  }

  public async getDefiVaultStats(args: {
    chainId: string;
    vault: `0x${string}`;
  }): Promise<DefiVaultStats> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const defiStats = await earnApi.getDefiVaultStats(args.vault);
    // Cannot be >1 contract deployed at the same address so return first element
    return DefiVaultsStateSchema.parse(defiStats)[0];
  }

  public async getDefiVaultStake(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    vault: `0x${string}`;
  }): Promise<DefiVaultStake> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const defiStakes = await earnApi.getDefiVaultStakes(args);
    // Safe can only have one stake per Vault so return first element
    return DefiVaultStakesSchema.parse(defiStakes)[0];
  }

  public async getDefiMorphoExtraRewards(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<DefiMorphoExtraReward>> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const defiMorphoExtraRewards = await earnApi.getDefiMorphoExtraRewards(
      args.safeAddress,
    );
    return DefiMorphoExtraRewardsSchema.parse(defiMorphoExtraRewards);
  }

  public async getStakes(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    validatorsPublicKeys: Array<`0x${string}`>;
  }): Promise<Array<Stake>> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const stakes = await earnApi.getStakes(args);
    return StakesSchema.parse(stakes);
  }

  public async clearStakes(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    await earnApi.clearStakes(args.safeAddress);
  }

  public async getTransactionStatus(args: {
    chainId: string;
    txHash: `0x${string}`;
  }): Promise<TransactionStatus> {
    const earnApi = await this.earnApiFactory.getApi(args.chainId);
    const txStatus = await earnApi.getTransactionStatus(args.txHash);
    return TransactionStatusSchema.parse(txStatus);
  }

  public clearApi(chainId: string): void {
    this.earnApiFactory.destroyApi(chainId);
  }
}
