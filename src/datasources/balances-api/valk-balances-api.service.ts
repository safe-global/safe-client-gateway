import { IConfigurationService } from '@/config/configuration.service.interface';
import { ValkBalance } from '@/datasources/balances-api/entities/valk-balance.entity';
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
import { getNumberString } from '@/domain/common/utils/utils';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { asError } from '@/logging/utils';
import { Inject, Injectable } from '@nestjs/common';
import { isHex } from 'viem';

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
    fiatCode: string;
  }): Promise<Balance[]> {
    try {
      const cacheDir = CacheRouter.getValkBalancesCacheDir(args);
      const chainName = this.getChainName(args.chainId);
      const url = `${this.baseUri}/balances/token/${args.safeAddress}?chain=${chainName}`;
      const valkBalances = await this.dataSource.get<ValkBalance[]>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: { headers: { Authorization: `${this.apiKey}` } },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
      return this.mapBalances(valkBalances, args.fiatCode);
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${args.safeAddress} balances from provider: ${asError(error).message}}`,
      );
    }
  }

  mapBalances(valkBalances: ValkBalance[], fiatCode: string): Balance[] {
    return valkBalances.map((valkBalance) => {
      const price = valkBalance.prices[fiatCode.toUpperCase()] ?? null;
      const balance = getNumberString(valkBalance.balance);
      const fiatBalance = getNumberString(
        (valkBalance.balance / Math.pow(10, valkBalance.decimals)) * price,
      );
      const fiatConversion = getNumberString(price);

      // Valk returns a string representing the native coin (e.g.: 'eth') as
      // token_address for native coins balances. An hex is returned for ERC20 tokens.
      if (isHex(valkBalance.token_address)) {
        return {
          tokenAddress: valkBalance.token_address,
          token: {
            name: valkBalance.name,
            symbol: valkBalance.symbol,
            decimals: valkBalance.decimals,
            logoUri: valkBalance.logo ?? '',
          },
          balance,
          fiatBalance,
          fiatConversion,
        } as Erc20Balance & {
          fiatBalance: string | null;
          fiatConversion: string | null;
        };
      } else {
        return {
          tokenAddress: null,
          token: null,
          balance,
          fiatBalance,
          fiatConversion,
        } as NativeBalance & {
          fiatBalance: string | null;
          fiatConversion: string | null;
        };
      }
    });
  }

  getChainName(chainId: string): string {
    const chainName = this.chainsConfiguration[Number(chainId)]?.chainName;
    if (!chainName)
      throw Error(
        `Chain ${chainId} balances retrieval via Valk is not configured`,
      );
    return chainName;
  }

  async clearBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const key = CacheRouter.getValkBalancesCacheKey(args);
    await this.cacheService.deleteByKey(key);
  }
}
