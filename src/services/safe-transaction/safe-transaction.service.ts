import { HttpService } from '@nestjs/axios';
import { Balance } from './entities/balance.entity';
import { HttpErrorHandler } from '../errors/http-error-handler';

export interface ISafeTransactionService {
  getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]>;
}

export class SafeTransactionService implements ISafeTransactionService {
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
      const { data } = await this.httpService.axiosRef.get(url, {
        params: { trusted: trusted, excludeSpam: excludeSpam },
      });
      return data;
    } catch (err) {
      this.httpErrorHandler.handle(err);
    }
  }
}
