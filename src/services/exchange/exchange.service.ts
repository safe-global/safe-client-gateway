import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ExchangeResult } from './entities/exchange.entity';

@Injectable()
export class ExchangeService {
  // TODO can we depend on the base url instead?
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {}

  async convertRates(to: string, from: string): Promise<number> {
    const exchangeResult = await this.getExchangeResult();

    if (exchangeResult.rates === undefined)
      throw new InternalServerErrorException(`Exchange rates unavailable`);

    const fromExchangeRate = exchangeResult.rates[from];
    if (fromExchangeRate === undefined || fromExchangeRate == 0)
      throw new InternalServerErrorException(
        `Exchange rate for ${from} is not available`,
      );
    const toExchangeRate = exchangeResult.rates[to];
    if (toExchangeRate === undefined)
      throw new InternalServerErrorException(
        `Exchange rate for ${to} is not available`,
      );

    return toExchangeRate / fromExchangeRate;
  }

  private async getExchangeResult(): Promise<ExchangeResult> {
    const baseUrl = this.configService.get<string>('exchange.baseUri');
    const apiKey = this.configService.get<string>('exchange.apiKey');

    try {
      const { data } = await this.httpService.axiosRef.get(baseUrl, {
        params: { access_key: apiKey },
      });
      return data;
    } catch (error) {
      this.httpErrorHandler.handle(error);
    }
  }
}
