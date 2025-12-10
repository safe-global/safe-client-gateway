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

export const IZerionWalletPortfolioApi = Symbol('IZerionWalletPortfolioApi');

export interface IZerionWalletPortfolioApi {
  /**
   * Fetches the portfolio data for a wallet from Zerion.
   * Uses the /v1/wallets/{address}/portfolio endpoint.
   *
   * @param args.address - Wallet address
   * @param args.currency - Fiat currency code (e.g., 'USD', 'EUR')
   * @param args.isTestnet - Whether the returned data is for testnets or for mainnets
   * @returns Portfolio data with total and per-chain breakdown
   */
  getPortfolio(args: {
    address: Address;
    currency: string;
    isTestnet: boolean;
  }): Promise<ZerionWalletPortfolio>;
}

@Injectable()
export class ZerionWalletPortfolioApi implements IZerionWalletPortfolioApi {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
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
  }): Promise<ZerionWalletPortfolio> {
    const url = `${this.baseUri}/v1/wallets/${args.address}/portfolio`;

    try {
      const { data } = await this.networkService.get<ZerionWalletPortfolio>({
        url,
        networkRequest: {
          headers: getZerionHeaders(this.apiKey, args.isTestnet),
          params: {
            currency: args.currency.toLowerCase(),
            'filter[positions]': 'no_filter',
          },
        },
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
