import { Balance } from './entities/balance.entity';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { Backbone } from '../../chains/entities';
import { INetworkService } from '../../common/network/network.service.interface';

export class TransactionApi {
  constructor(
    private readonly baseUrl: string,
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

  async getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/balances/usd/`;
    try {
      const { data } = await this.networkService.get(url, {
        params: { trusted: trusted, excludeSpam: excludeSpam },
      });
      return data;
    } catch (err) {
      throw this.httpErrorFactory.from(err);
    }
  }

  async getBackbone(): Promise<Backbone> {
    const url = `${this.baseUrl}/api/v1/about`;
    try {
      const { data } = await this.networkService.get(url);
      return data;
    } catch (err) {
      throw this.httpErrorFactory.from(err);
    }
  }
}
