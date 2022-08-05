import { HttpService } from '@nestjs/axios';
import { HttpException, Inject } from '@nestjs/common';
import { Balance } from './entities/balance.entity';

// TODO: we might be able to use DI for this one (Assisted Dependency Injection/multibinding)
export class SafeTransactionService {
  constructor(
    @Inject('baseUrl') private readonly baseUrl: string,
    @Inject('httpService') private readonly httpService: HttpService,
  ) {}

  async getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    const url = this.baseUrl + `/api/v1/safes/${safeAddress}/balances/usd/`;
    try {
      const response = await this.httpService.axiosRef.get(url, {
        params: { trusted: trusted, excludeSpam: excludeSpam },
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
        throw new HttpException(
          error.response.data.message,
          error.response.status,
        );
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error', error.message);
      }
    }
  }
}
