import { IConfigurationService } from '@/config/configuration.service.interface';
import { ValkBalance } from '@/datasources/balances-api/entities/valk-balance.entity';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { Balance } from '@/domain/balances/entities/balance.entity';
import { BalanceToken } from '@/domain/balances/entities/balance.token.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { asError } from '@/logging/utils';
import { Inject, Injectable } from '@nestjs/common';

export const IValkBalancesApi = Symbol('IValkBalancesApi');

type ChainAttributes = {
  chainName: string;
  nativeCoin?: string;
};

@Injectable()
export class ValkBalancesApi implements IBalancesApi {
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
      'balances.providers.valk.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.valk.baseUri',
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
    >('balances.providers.valk.chains');
  }

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<Balance[]> {
    try {
      const cacheDir = CacheRouter.getValkBalancesCacheDir(args);
      const chainName = this.getChainName(args.chainId);
      const url = `${this.baseUri}/balances/token/${args.safeAddress}?chain=${chainName}`;
      const res = await this.dataSource.get<ValkBalance[]>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: { headers: { Authorization: `${this.apiKey}` } },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
      return this.mapBalances(res);
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${args.safeAddress} balances from provider: ${asError(error).message}}`,
      );
    }
  }

  mapBalances(valkBalances: ValkBalance[]): Balance[] {
    const mapPrice = (prices: Record<string, number>): number => prices['USD']; // TODO: use currency
    const mapToken = (vb: ValkBalance): BalanceToken => ({
      name: vb.name,
      symbol: vb.symbol,
      decimals: vb.decimals,
      logoUri: vb.thumbnail ?? '',
    });

    return valkBalances.map((vb) => ({
      tokenAddress: vb.token_address,
      token: mapToken(vb),
      balance: getNumberString(vb.balance),
      fiatBalance: getNumberString(
        (vb.balance / Math.pow(10, vb.decimals)) * mapPrice(vb.prices),
      ),
      fiatConversion: getNumberString(mapPrice(vb.prices)),
    }));
  }

  getChainName(chainId: string): string {
    const chainName = this.chainsConfiguration[chainId]?.chainName;
    if (!chainName)
      throw Error(
        `Chain ${chainId} balances retrieval via Valk is not configured`,
      );
    return chainName;
  }

  clearBalances(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
