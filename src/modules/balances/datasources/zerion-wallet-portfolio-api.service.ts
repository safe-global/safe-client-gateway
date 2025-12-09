import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { getZerionHeaders } from '@/modules/balances/datasources/zerion-api.helpers';
import {
  ZerionWalletPortfolioSchema,
  type ZerionWalletPortfolio,
} from '@/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';
import type { Address } from 'viem';

export const IZerionWalletPortfolioApi = Symbol('IZerionWalletPortfolioApi');

export interface IZerionWalletPortfolioApi {
  /**
   * Fetches the portfolio total for a wallet from Zerion.
   * Uses the /v1/wallets/{address}/portfolio endpoint.
   *
   * @param args.address - Wallet address
   * @param args.currency - Fiat currency code (e.g., 'USD', 'EUR')
   * @param args.isTestnet - Whether this is a testnet chain
   * @returns Total portfolio value in fiat
   */
  getPortfolioTotal(args: {
    address: Address;
    currency: string;
    isTestnet: boolean;
  }): Promise<number>;
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
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
  }

  async getPortfolioTotal(args: {
    address: Address;
    currency: string;
    isTestnet: boolean;
  }): Promise<number> {
    const url = `${this.baseUri}/v1/wallets/${args.address}/portfolio`;

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

    const validated = ZerionWalletPortfolioSchema.parse(data);
    return validated.data.attributes.total.positions;
  }
}
