// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { getZerionHeaders } from '@/modules/balances/datasources/zerion-api.helpers';
import {
  ZerionWalletPortfolioSchema,
  type ZerionWalletPortfolio,
} from '@/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';
import type { Address } from 'viem';
import { ZodError } from 'zod';

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
   * @returns Portfolio data with total and per-chain breakdown
   */
  getPortfolio(args: {
    address: Address;
    currency: string;
    isTestnet: boolean;
    trusted?: boolean;
  }): Promise<ZerionWalletPortfolio>;
}

@Injectable()
export class ZerionWalletPortfolioApi implements IZerionWalletPortfolioApi {
  private static readonly CACHE_TTL_SECONDS = 10;
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  async getPortfolio(args: {
    address: Address;
    currency: string;
    isTestnet: boolean;
    trusted?: boolean;
  }): Promise<ZerionWalletPortfolio> {
    const cacheDir = CacheRouter.getZerionWalletPortfolioCacheDir({
      address: args.address,
      fiatCode: args.currency,
      trusted: args.trusted,
      isTestnet: args.isTestnet,
    });

    const url = `${this.baseUri}/v1/wallets/${args.address}/portfolio`;
    const params: Record<string, string> = {
      currency: args.currency.toLowerCase(),
      'filter[positions]': 'no_filter',
    };

    if (args.trusted) {
      params['filter[trash]'] = 'only_non_trash';
    }

    try {
      const data = await this.dataSource.get<ZerionWalletPortfolio>({
        cacheDir,
        url,
        networkRequest: {
          headers: getZerionHeaders(this.apiKey, args.isTestnet),
          params,
        },
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: ZerionWalletPortfolioApi.CACHE_TTL_SECONDS,
      });

      return ZerionWalletPortfolioSchema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }
}
