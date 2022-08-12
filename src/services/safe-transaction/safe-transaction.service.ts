import { HttpService } from '@nestjs/axios';
import { Balance } from './entities/balance.entity';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { Backbone } from '../../chains/entities/backbone.entity';

export class SafeTransactionService {
  constructor(
    private readonly baseUrl: string,
    private readonly httpService: HttpService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {}

  async getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    const url = this.baseUrl + `/api/v1/safes/${safeAddress}/balances/usd/`;
    try {
      const res = await this.httpService.axiosRef.get(url, {
        params: { trusted: trusted, excludeSpam: excludeSpam },
      });
      return res?.data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }

  async getBackbone(): Promise<Backbone> {
    const url = this.baseUrl + `/api/v1/about`;
    try {
      const res = await this.httpService.axiosRef.get(url);
      return res?.data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }
}
