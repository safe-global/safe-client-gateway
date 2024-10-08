import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { Balance } from '@/domain/balances/entities/balance.entity';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { Page } from '@/domain/entities/page.entity';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { IPricesApi } from '@/datasources/balances-api/prices-api.interface';
import { Injectable } from '@nestjs/common';
import { Chain } from '@/domain/chains/entities/chain.entity';

@Injectable()
export class SafeBalancesApi implements IBalancesApi {
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;
  private static readonly DEFAULT_DECIMALS = 18;
  private static readonly HOLESKY_CHAIN_ID = '17000';

  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly dataSource: CacheFirstDataSource,
    private readonly cacheService: ICacheService,
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    private readonly coingeckoApi: IPricesApi,
  ) {
    // TODO: Remove temporary cache times for Holesky chain.
    if (chainId === SafeBalancesApi.HOLESKY_CHAIN_ID) {
      const holeskyExpirationTime =
        this.configurationService.getOrThrow<number>(
          'expirationTimeInSeconds.holesky',
        );
      this.defaultExpirationTimeInSeconds = holeskyExpirationTime;
      this.defaultNotFoundExpirationTimeSeconds = holeskyExpirationTime;
    } else {
      this.defaultExpirationTimeInSeconds =
        this.configurationService.getOrThrow<number>(
          'expirationTimeInSeconds.default',
        );
      this.defaultNotFoundExpirationTimeSeconds =
        this.configurationService.getOrThrow<number>(
          'expirationTimeInSeconds.notFound.default',
        );
    }
  }

  async getBalances(args: {
    safeAddress: `0x${string}`;
    fiatCode: string;
    chain: Chain;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]> {
    try {
      const cacheDir = CacheRouter.getBalancesCacheDir({
        chainId: this.chainId,
        ...args,
      });
      const url = `${this.baseUrl}/api/v1/safes/${args.safeAddress}/balances/`;
      const data = await this.dataSource.get<Balance[]>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            trusted: args.trusted,
            exclude_spam: args.excludeSpam,
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });

      return this._mapBalances(data, args.fiatCode, args.chain);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearBalances(args: { safeAddress: `0x${string}` }): Promise<void> {
    const key = CacheRouter.getBalancesCacheKey({
      chainId: this.chainId,
      safeAddress: args.safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async getCollectibles(args: {
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>> {
    try {
      const cacheDir = CacheRouter.getCollectiblesCacheDir({
        chainId: this.chainId,
        ...args,
      });
      const url = `${this.baseUrl}/api/v2/safes/${args.safeAddress}/collectibles/`;
      return await this.dataSource.get({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
            trusted: args.trusted,
            exclude_spam: args.excludeSpam,
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearCollectibles(args: { safeAddress: `0x${string}` }): Promise<void> {
    const key = CacheRouter.getCollectiblesKey({
      chainId: this.chainId,
      safeAddress: args.safeAddress,
    });
    await this.cacheService.deleteByKey(key);
  }

  async getFiatCodes(): Promise<string[]> {
    return this.coingeckoApi.getFiatCodes();
  }

  /**
   * Gets the USD price of the native coin of the chain associated with {@link chainId}.
   */
  async getNativeCoinPrice(chain: Chain): Promise<number | null> {
    return this.coingeckoApi.getNativeCoinPrice({
      chain,
      fiatCode: 'USD',
    });
  }

  private async _mapBalances(
    balances: Balance[],
    fiatCode: string,
    chain: Chain,
  ): Promise<Balance[]> {
    const tokenAddresses = balances
      .map((balance) => balance.tokenAddress)
      .filter((address): address is `0x${string}` => address !== null);

    const assetPrices = await this.coingeckoApi.getTokenPrices({
      chain,
      fiatCode,
      tokenAddresses,
    });

    const lowerCaseAssetPrices = assetPrices?.map((assetPrice) =>
      Object.fromEntries(
        Object.entries(assetPrice).map(([k, v]) => [k.toLowerCase(), v]),
      ),
    );

    return await Promise.all(
      balances.map(async (balance) => {
        const tokenAddress = balance.tokenAddress?.toLowerCase() ?? null;
        let price: number | null;
        if (tokenAddress === null) {
          price = await this.coingeckoApi.getNativeCoinPrice({
            chain,
            fiatCode,
          });
        } else {
          const found = lowerCaseAssetPrices.find(
            (assetPrice) => assetPrice[tokenAddress],
          );
          price = found?.[tokenAddress]?.[fiatCode.toLowerCase()] ?? null;
        }
        const fiatBalance = this._getFiatBalance(price, balance);
        return {
          ...balance,
          fiatBalance: fiatBalance ? getNumberString(fiatBalance) : null,
          fiatConversion: price ? getNumberString(price) : null,
        };
      }),
    );
  }

  private _getFiatBalance(
    price: number | null,
    balance: Balance,
  ): number | null {
    return price !== null
      ? (price * Number(balance.balance)) /
          10 ** (balance.token?.decimals ?? SafeBalancesApi.DEFAULT_DECIMALS)
      : null;
  }
}
