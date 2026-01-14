import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { getZerionHeaders } from '@/modules/balances/datasources/zerion-api.helpers';
import {
  ZerionWalletPortfolioSchema,
  type ZerionWalletPortfolio,
} from '@/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';
import type { Address } from 'viem';
import { ZodError } from 'zod';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';

export const IZerionWalletPortfolioApi = Symbol('IZerionWalletPortfolioApi');

export interface IZerionWalletPortfolioApi {
  /**
   * Fetches the portfolio data for a wallet from Zerion.
   * Uses the /v1/wallets/{address}/portfolio endpoint.
   *
   * @param args.address - Wallet address
   * @param args.currency - Fiat currency code (e.g., 'USD', 'EUR')
   * @param args.isTestnet - Whether the returned data is for testnets or for mainnets
   * @param args.trusted - If true, only includes trusted (non-trash) tokens (optional)
   * @param args.excludeSpam - If true, excludes spam (trash) tokens (optional)
   * @returns Portfolio data with total and per-chain breakdown
   */
  getPortfolio(args: {
    address: Address;
    currency: string;
    isTestnet: boolean;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<ZerionWalletPortfolio>;
}

@Injectable()
export class ZerionWalletPortfolioApi implements IZerionWalletPortfolioApi {
  private static readonly CACHE_TTL_SECONDS = 10;
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
  }

  async getPortfolio(args: {
    address: Address;
    currency: string;
    isTestnet: boolean;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<ZerionWalletPortfolio> {
    const cacheDir = CacheRouter.getPortfolioCacheDir({
      address: args.address,
      fiatCode: args.currency,
      isTestnet: args.isTestnet,
    });

    const { key, field } = cacheDir;

    const cached = await this.cacheService.hGet(cacheDir);
    if (cached != null) {
      this.loggingService.debug({ type: LogType.CacheHit, key, field });
      return ZerionWalletPortfolioSchema.parse(JSON.parse(cached));
    }

    this.loggingService.debug({ type: LogType.CacheMiss, key, field });

    const url = `${this.baseUri}/v1/wallets/${args.address}/portfolio`;

    const params: Record<string, string> = {
      currency: args.currency.toLowerCase(),
      'filter[positions]': 'no_filter',
    };

    if (args.trusted || args.excludeSpam) {
      params['filter[trash]'] = 'only_non_trash';
    }

    try {
      const { data } = await this.networkService.get<ZerionWalletPortfolio>({
        url,
        networkRequest: {
          headers: getZerionHeaders(this.apiKey, args.isTestnet),
          params,
        },
      });

      const portfolio = ZerionWalletPortfolioSchema.parse(data);

      await this.cacheService.hSet(
        cacheDir,
        JSON.stringify(portfolio),
        ZerionWalletPortfolioApi.CACHE_TTL_SECONDS,
      );

      return portfolio;
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }
}
