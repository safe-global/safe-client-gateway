import { Balance } from './entities/balance.entity';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { Backbone } from '../../chains/entities';
import { INetworkService } from '../../common/network/network.service.interface';

export class TransactionService {
  constructor(
    private readonly baseUrl: string,
    private readonly networkService: INetworkService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {}

  async getBalances(safeAddress: string, trusted?: boolean, excludeSpam?: boolean): Promise<Balance[]> {
    const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/balances/usd/`;
    try {
      const { data } = await this.networkService.get(url, {
        params: { trusted: trusted, excludeSpam: excludeSpam },
      });
      return data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }

  async getBackbone(): Promise<Backbone> {
    const url = `${this.baseUrl}/api/v1/about`;
    try {
      const { data } = await this.networkService.get(url);
      return data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }
}
