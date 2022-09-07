import { IExchangeRepository } from './exchange.repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import { IExchangeApi } from '../interfaces/exchange-api.interface';

@Injectable()
export class ExchangeRepository implements IExchangeRepository {
  constructor(
    @Inject(IExchangeApi) private readonly exchangeApi: IExchangeApi,
  ) {}

  async convertRates(to: string, from: string): Promise<number> {
    return this.exchangeApi.convertRates(to, from);
  }

  async getFiatCodes(): Promise<string[]> {
    return this.exchangeApi.getFiatCodes();
  }
}
