import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import type { DefiMorphoExtraReward } from '@/datasources/staking-api/entities/defi-morpho-extra-reward.entity';
import type { DefiVaultStake } from '@/datasources/staking-api/entities/defi-vault-stake.entity';
import type {
  DefiVaultStats,
  DefiVaultStatsChains,
} from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import type { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import type { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import type { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import type { RewardsFee } from '@/datasources/staking-api/entities/rewards-fee.entity';
import type { Stake } from '@/datasources/staking-api/entities/stake.entity';
import type { TransactionStatus } from '@/datasources/staking-api/entities/transaction-status.entity';
import type { IStakingApi } from '@/domain/interfaces/staking-api.interface';
import type { Raw } from '@/validation/entities/raw.entity';
import { z, ZodError } from 'zod';

export class KilnApi implements IStakingApi {
  public static DefiVaultStatsChains: {
    [key in (typeof DefiVaultStatsChains)[number]]: string;
  } = {
    eth: '1',
    arb: '42161',
    bsc: '56',
    matic: '137',
    op: '10',
    base: '8453',
  };

  private readonly stakingExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly dataSource: CacheFirstDataSource,
    private readonly httpErrorFactory: HttpErrorFactory,
    private readonly configurationService: IConfigurationService,
    private readonly cacheService: ICacheService,
    private readonly chainId: string,
    private readonly cacheType: 'earn' | 'staking',
  ) {
    this.stakingExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.staking',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getDeployments(): Promise<Raw<Array<Deployment>>> {
    const url = `${this.baseUrl}/v1/deployments`;
    const cacheDir = CacheRouter.getStakingDeploymentsCacheDir(this.cacheType);
    return await this.get<{
      data: Array<Deployment>;
    }>({
      cacheDir,
      url,
      networkRequest: {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
      notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      expireTimeSeconds: this.stakingExpirationTimeInSeconds,
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getRewardsFee(contract: `0x${string}`): Promise<Raw<RewardsFee>> {
    const url = `${this.baseUrl}/v1/eth/onchain/v1/fee`;
    const cacheDir = CacheRouter.getStakingRewardsFeeCacheDir({
      cacheType: this.cacheType,
      chainId: this.chainId,
      contract,
    });
    return await this.get<{
      data: RewardsFee;
    }>({
      cacheDir,
      url,
      networkRequest: {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        params: {
          integration: contract,
        },
      },
      notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      expireTimeSeconds: this.stakingExpirationTimeInSeconds,
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getNetworkStats(): Promise<Raw<NetworkStats>> {
    const url = `${this.baseUrl}/v1/eth/network-stats`;
    const cacheDir = CacheRouter.getStakingNetworkStatsCacheDir(this.cacheType);
    return await this.get<{ data: NetworkStats }>({
      cacheDir,
      url,
      networkRequest: {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
      notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      expireTimeSeconds: this.stakingExpirationTimeInSeconds,
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getDedicatedStakingStats(): Promise<Raw<DedicatedStakingStats>> {
    const url = `${this.baseUrl}/v1/eth/kiln-stats`;
    const cacheDir = CacheRouter.getStakingDedicatedStakingStatsCacheDir(
      this.cacheType,
    );
    return await this.get<{
      data: DedicatedStakingStats;
    }>({
      cacheDir,
      url,
      networkRequest: {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
      notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      expireTimeSeconds: this.stakingExpirationTimeInSeconds,
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getPooledStakingStats(
    pool: `0x${string}`,
  ): Promise<Raw<PooledStakingStats>> {
    const url = `${this.baseUrl}/v1/eth/onchain/v2/network-stats`;
    const cacheDir = CacheRouter.getStakingPooledStakingStatsCacheDir({
      cacheType: this.cacheType,
      pool,
    });
    return await this.get<{
      data: PooledStakingStats;
    }>({
      cacheDir,
      url,
      networkRequest: {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        params: {
          integration: pool,
        },
      },
      notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      expireTimeSeconds: this.stakingExpirationTimeInSeconds,
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getDefiVaultStats(
    vault: `0x${string}`,
  ): Promise<Raw<Array<DefiVaultStats>>> {
    const url = `${this.baseUrl}/v1/defi/network-stats`;
    const cacheDir = CacheRouter.getStakingDefiVaultStatsCacheDir({
      cacheType: this.cacheType,
      chainId: this.chainId,
      vault,
    });
    return await this.get<{
      data: Array<DefiVaultStats>;
    }>({
      cacheDir,
      url,
      networkRequest: {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        params: {
          vaults: this.getDefiVaultIdentifier(vault),
        },
      },
      notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      expireTimeSeconds: this.stakingExpirationTimeInSeconds,
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getDefiVaultStakes(args: {
    safeAddress: `0x${string}`;
    vault: `0x${string}`;
  }): Promise<Raw<Array<DefiVaultStake>>> {
    const url = `${this.baseUrl}/v1/defi/stakes`;
    const cacheDir = CacheRouter.getStakingDefiVaultStakesCacheDir({
      cacheType: this.cacheType,
      chainId: this.chainId,
      safeAddress: args.safeAddress,
      vault: args.vault,
    });
    return await this.get<{
      data: Array<DefiVaultStake>;
    }>({
      cacheDir,
      url,
      networkRequest: {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        params: {
          vaults: this.getDefiVaultIdentifier(args.vault),
          wallets: args.safeAddress,
        },
      },
      notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      expireTimeSeconds: this.stakingExpirationTimeInSeconds,
    });
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getDefiMorphoExtraRewards(
    safeAddress: `0x${string}`,
  ): Promise<Raw<Array<DefiMorphoExtraReward>>> {
    const url = `${this.baseUrl}/v1/defi/extra-rewards/morpho`;
    const cacheDir = CacheRouter.getStakingDefiMorphoExtraRewardsCacheDir({
      cacheType: this.cacheType,
      chainId: this.chainId,
      safeAddress,
    });
    return await this.get<{
      data: Array<DefiMorphoExtraReward>;
    }>({
      cacheDir,
      url,
      networkRequest: {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        params: {
          wallets: safeAddress,
        },
      },
      notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      expireTimeSeconds: this.stakingExpirationTimeInSeconds,
    });
  }

  /**
   * Gets the {@link Stake} for the given {@param args.validatorsPublicKeys}.
   *
   * The {@param args.safeAddress} is only used for caching purposes.
   *
   * @param {string} args.safeAddress - Safe address
   * @param {string} args.validatorsPublicKeys - Validators public keys
   *
   * @returns {@link Stake} array
   * @see https://docs.api.kiln.fi/reference/getethstakes
   */
  async getStakes(args: {
    safeAddress: `0x${string}`;
    validatorsPublicKeys: Array<`0x${string}`>;
  }): Promise<Raw<Array<Stake>>> {
    const url = `${this.baseUrl}/v1/eth/stakes`;
    const cacheDir = CacheRouter.getStakingStakesCacheDir({
      cacheType: this.cacheType,
      chainId: this.chainId,
      safeAddress: args.safeAddress,
      validatorsPublicKeys: args.validatorsPublicKeys,
    });
    return await this.get<{
      data: Array<Stake>;
    }>({
      cacheDir,
      url,
      networkRequest: {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        params: {
          validators: args.validatorsPublicKeys.join(','),
          // Adds net_claimable_consensus_rewards to response
          onchain_v1_include_net_rewards: true,
        },
      },
      notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      expireTimeSeconds: this.stakingExpirationTimeInSeconds,
    });
  }

  /**
   * Clears the {@link Stake} cache for the {@param safeAddress}.
   *
   * @param {string} safeAddress - Safe address
   */
  async clearStakes(safeAddress: `0x${string}`): Promise<void> {
    const key = CacheRouter.getStakingStakesCacheKey({
      chainId: this.chainId,
      safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async getTransactionStatus(
    txHash: `0x${string}`,
  ): Promise<Raw<TransactionStatus>> {
    const url = `${this.baseUrl}/v1/eth/transaction/status`;
    const cacheDir = CacheRouter.getStakingTransactionStatusCacheDir({
      cacheType: this.cacheType,
      chainId: this.chainId,
      txHash,
    });
    return await this.get<TransactionStatus>({
      cacheDir,
      url,
      networkRequest: {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        params: {
          tx_hash: txHash,
        },
      },
      notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
      expireTimeSeconds: this.stakingExpirationTimeInSeconds,
    });
  }

  /**
   * Parses response from Raw<T> to { data: Raw<T> } as Kiln API returns { data: T }
   * @param args - arguments for {@link CacheFirstDataSource.get}
   * @returns rawified response
   */
  private async get<T>(
    args: Parameters<typeof this.dataSource.get>[0],
  ): Promise<Raw<T>> {
    try {
      const { data } = await this.dataSource
        .get<{
          data: TransactionStatus;
        }>(args)
        .then((res) => {
          // Ensuring response is { data: T }, the data is parsed in the domain
          return z.object({ data: z.unknown() }).parse(res) as { data: Raw<T> };
        });
      return data;
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * Converts array of chainId and vault to DeFi vault identifier
   * @param args.chainId - chain ID
   * @param args.vault - vault address
   *
   * @returns array of DeFi vault identifiers - `chainIdentifier_vault`, e.g. `eth_0x123`
   * @see https://docs.api.kiln.fi/reference/getdefinetworkstats
   */
  private getDefiVaultIdentifier(vault: `0x${string}`): string {
    const chain = Object.entries(KilnApi.DefiVaultStatsChains).find(
      ([, chainId]) => {
        return chainId === this.chainId;
      },
    );

    if (chain) {
      const chainIdentifier = chain[0];
      return `${chainIdentifier}_${vault}`;
    } else {
      throw new Error(`${this.chainId} is not supported for DeFi by Kiln`);
    }
  }
}
