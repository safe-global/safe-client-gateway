import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { Balance } from './entities/balance.entity';
import { HttpErrorMapper } from '../errors/http-error-mapper';

// TODO: we might be able to use DI for this one (Assisted Dependency Injection/multibinding)
export class SafeTransactionService {
  constructor(
    @Inject() private readonly baseUrl: string,
    @Inject() private readonly httpService: HttpService,
    @Inject() private readonly httpErrorMapper: HttpErrorMapper,
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
      this.httpErrorMapper.mapError(err);
    }
  }
}
