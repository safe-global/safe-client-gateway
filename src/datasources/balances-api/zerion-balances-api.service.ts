import { IConfigurationService } from '@/config/configuration.service.interface';
import { ZerionBalance } from '@/datasources/balances-api/entities/zerion-balance.entity';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  Balance,
  Erc20Balance,
  NativeBalance,
} from '@/domain/balances/entities/balance.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { asError } from '@/logging/utils';
import { Inject, Injectable } from '@nestjs/common';

// TODO: move to a common place
type ChainAttributes = {
  chainName: string;
  nativeCoin?: string;
};

@Injectable()
export class ZerionBalancesApi implements IBalancesApi {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly chainsConfiguration: Record<number, ChainAttributes>;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
    this.chainsConfiguration = this.configurationService.getOrThrow<
      Record<number, ChainAttributes>
    >('balances.providers.zerion.chains');
  }

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
  }): Promise<Balance[]> {
    try {
      const cacheDir = CacheRouter.getZerionBalancesCacheDir(args);
      const chainName = this._getChainName(args.chainId);
      const currency = args.fiatCode.toLowerCase();
      const url = `${this.baseUri}/v1/wallets/${args.safeAddress}/positions?filter[chain_ids]=${chainName}&currency=${currency}&sort=value`;
      const zerionBalances = await this.dataSource.get<ZerionBalance[]>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: { headers: { Authorization: `${this.apiKey}` } },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
      return this._mapBalances(chainName, zerionBalances);
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${args.safeAddress} balances from provider: ${asError(error).message}}`,
      );
    }
  }

  private _mapBalances(
    chainName: string,
    zerionBalances: ZerionBalance[],
  ): Balance[] {
    return zerionBalances.map((zb) => {
      const implementation = zb.attributes.fungible_info.implementations.find(
        (implementation) => implementation.chain_id === chainName,
      );
      const fiatBalance = '0'; // TODO:
      const fiatConversion = '0'; // TODO:
      return {
        ...(implementation?.address === null
          ? this._mapNativeBalance(zb, chainName)
          : this._mapErc20Balance(zb, chainName)),
        fiatBalance,
        fiatConversion,
      };
    });
  }

  private _mapErc20Balance(
    zerionBalance: ZerionBalance,
    chainName: string,
  ): Erc20Balance {
    zerionBalance;
    chainName;
    throw Error('Not implemented');
  }

  private _mapNativeBalance(
    zerionBalance: ZerionBalance,
    chainName: string,
  ): NativeBalance {
    zerionBalance;
    chainName;
    throw Error('Not implemented');
  }

  async clearBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const key = CacheRouter.getZerionBalancesCacheKey(args);
    await this.cacheService.deleteByKey(key);
  }

  private _getChainName(chainId: string): string {
    const chainName = this.chainsConfiguration[Number(chainId)]?.chainName;
    if (!chainName)
      throw Error(
        `Chain ${chainId} balances retrieval via Zerion is not configured`,
      );
    return chainName;
  }
}
