import { IExchangeRepository } from './exchange.repository.interface';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { IExchangeApi } from '../interfaces/exchange-api.interface';
import { ExchangeFiatCodesValidator } from './exchange-fiat-codes.validator';
import { ExchangeRatesValidator } from './exchange-rates.validator';

@Injectable()
export class ExchangeRepository implements IExchangeRepository {
  constructor(
    @Inject(IExchangeApi) private readonly exchangeApi: IExchangeApi,
    private readonly exchangeRatesValidator: ExchangeRatesValidator,
    private readonly exchangeFiatCodesValidator: ExchangeFiatCodesValidator,
  ) {}

  async convertRates(to: string, from: string): Promise<number> {
    const exchangeRates = await this.exchangeApi.getRates();
    this.exchangeRatesValidator.validate(exchangeRates);

    const fromExchangeRate = exchangeRates.rates[from.toUpperCase()];
    if (fromExchangeRate === undefined || fromExchangeRate == 0)
      throw new InternalServerErrorException(
        `Exchange rate for ${from} is not available`,
      );

    const toExchangeRate = exchangeRates.rates[to.toUpperCase()];
    if (toExchangeRate === undefined)
      throw new InternalServerErrorException(
        `Exchange rate for ${to} is not available`,
      );

    return toExchangeRate / fromExchangeRate;
  }

  async getFiatCodes(): Promise<string[]> {
    const data = await this.exchangeApi.getFiatCodes();
    this.exchangeFiatCodesValidator.validate(data);
    return Object.keys(data.symbols);
  }
}
