import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import { DefiVaultStats } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import { Stake } from '@/datasources/staking-api/entities/stake.entity';
import { IStakingApi } from '@/domain/interfaces/staking-api.interface';

export class KilnApi implements IStakingApi {
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
  async getDeployments(): Promise<Array<Deployment>> {
    try {
      const url = `${this.baseUrl}/v1/deployments`;
      const cacheDir = CacheRouter.getStakingDeploymentsCacheDir();
      // Note: Kiln always return { data: T }
      const { data } = await this.dataSource.get<{
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
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getNetworkStats(): Promise<NetworkStats> {
    try {
      const url = `${this.baseUrl}/v1/eth/network-stats`;
      const cacheDir = CacheRouter.getStakingNetworkStatsCacheDir();
      // Note: Kiln always return { data: T }
      const { data } = await this.dataSource.get<{ data: NetworkStats }>({
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
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getDedicatedStakingStats(): Promise<DedicatedStakingStats> {
    try {
      const url = `${this.baseUrl}/v1/eth/kiln-stats`;
      const cacheDir = CacheRouter.getStakingDedicatedStakingStatsCacheDir();
      // Note: Kiln always return { data: T }
      const { data } = await this.dataSource.get<{
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
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getPooledStakingStats(
    pool: `0x${string}`,
  ): Promise<PooledStakingStats> {
    try {
      const url = `${this.baseUrl}/v1/eth/onchain/v2/network-stats`;
      const cacheDir = CacheRouter.getStakingPooledStakingStatsCacheDir(pool);
      // Note: Kiln always return { data: T }
      const { data } = await this.dataSource.get<{
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
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  // Important: there is no hook which invalidates this endpoint,
  // Therefore, this data will live in cache until [stakingExpirationTimeInSeconds]
  async getDefiVaultStats(args: {
    chainId: string;
    vault: `0x${string}`;
  }): Promise<Array<DefiVaultStats>> {
    try {
      const url = `${this.baseUrl}/v1/defi/network-stats`;
      const cacheDir = CacheRouter.getStakingDefiVaultStatsCacheDir(args);
      // Note: Kiln always return { data: T }
      const { data } = await this.dataSource.get<{
        data: Array<DefiVaultStats>;
      }>({
        cacheDir,
        url,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          params: {
            vaults: this.getDefiVaultIdentifier(args),
          },
        },
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.stakingExpirationTimeInSeconds,
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
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
  }): Promise<Stake[]> {
    try {
      const url = `${this.baseUrl}/v1/eth/stakes`;
      const cacheDir = CacheRouter.getStakingStakesCacheDir({
        chainId: this.chainId,
        safeAddress: args.safeAddress,
        validatorsPublicKeys: args.validatorsPublicKeys,
      });
      // Note: Kiln always return { data: T }
      const { data } = await this.dataSource.get<{
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
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
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

  /**
   * Converts array of chainId and vault to DeFi vault identifier
   * @param args.chainId - chain ID
   * @param args.vault - vault address
   *
   * @returns array of DeFi vault identifiers - `chainIdentifier_vault`, e.g. `eth_0x123`
   * @see https://docs.api.kiln.fi/reference/getdefinetworkstats
   */
  private getDefiVaultIdentifier(args: {
    // TODO: Can use this.chainId
    chainId: string;
    vault: `0x${string}`;
  }): string {
    // TODO: Type this in accordance with DefiVaultStatsChains, throwing if this.chainId isn't supported
    const chainIdentifiers = {
      '1': 'eth',
      '42161': 'arb',
      '56': 'bsc',
      '137': 'matic',
      '10': 'op',
    };

    // Note: cannot narrow without it being a separate type guard
    const isDeFiSupportedChain = (
      chainId: string,
    ): chainId is keyof typeof chainIdentifiers => {
      return chainId in chainIdentifiers;
    };

    if (isDeFiSupportedChain(args.chainId)) {
      const chainIdentifier = chainIdentifiers[args.chainId];
      return `${chainIdentifier}_${args.vault}`;
    } else {
      throw new Error(`${args.chainId} is not supported for DeFi by Kiln`);
    }
  }
}
