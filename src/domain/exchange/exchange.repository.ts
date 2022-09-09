import { IExchangeRepository } from './exchange.repository.interface';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { IExchangeApi } from '../interfaces/exchange-api.interface';
import { ExchangeValidator } from './exchange.validator';

@Injectable()
export class ExchangeRepository implements IExchangeRepository {
  constructor(
    @Inject(IExchangeApi) private readonly exchangeApi: IExchangeApi,
    private readonly validator: ExchangeValidator,
  ) {}

  async convertRates(to: string, from: string): Promise<number> {
    const exchangeResult = await this.exchangeApi.getExchangeResult();
    this.validator.validate(exchangeResult);

    const fromExchangeRate = exchangeResult.rates[from.toUpperCase()];
    if (fromExchangeRate === undefined || fromExchangeRate == 0)
      throw new InternalServerErrorException(
        `Exchange rate for ${from} is not available`,
      );

    const toExchangeRate = exchangeResult.rates[to.toUpperCase()];
    if (toExchangeRate === undefined)
      throw new InternalServerErrorException(
        `Exchange rate for ${to} is not available`,
      );

    return toExchangeRate / fromExchangeRate;
  }

  async getFiatCodes(): Promise<string[]> {
    const data = await this.exchangeApi.getFiatCodes();
    this.validator.validate(data);
    return Object.keys(data.symbols);
  }
}
