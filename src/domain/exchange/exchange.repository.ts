import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ExchangeFiatCodesValidator } from '@/domain/exchange/exchange-fiat-codes.validator';
import { ExchangeRatesValidator } from '@/domain/exchange/exchange-rates.validator';
import { IExchangeRepository } from '@/domain/exchange/exchange.repository.interface';
import { IExchangeApi } from '@/domain/interfaces/exchange-api.interface';

@Injectable()
export class ExchangeRepository implements IExchangeRepository {
  constructor(
    @Inject(IExchangeApi) private readonly exchangeApi: IExchangeApi,
    private readonly exchangeRatesValidator: ExchangeRatesValidator,
    private readonly exchangeFiatCodesValidator: ExchangeFiatCodesValidator,
  ) {}

  async convertRates(args: { to: string; from: string }): Promise<number> {
    const exchangeRates = await this.exchangeApi.getRates();
    this.exchangeRatesValidator.validate(exchangeRates);

    const fromExchangeRate = exchangeRates.rates[args.from.toUpperCase()];
    if (fromExchangeRate === undefined || fromExchangeRate == 0)
      throw new InternalServerErrorException(
        `Exchange rate for ${args.from} is not available`,
      );

    const toExchangeRate = exchangeRates.rates[args.to.toUpperCase()];
    if (toExchangeRate === undefined)
      throw new InternalServerErrorException(
        `Exchange rate for ${args.to} is not available`,
      );

    return toExchangeRate / fromExchangeRate;
  }

  async getFiatCodes(): Promise<string[]> {
    const data = await this.exchangeApi.getFiatCodes();
    this.exchangeFiatCodesValidator.validate(data);
    return Object.keys(data.symbols);
  }
}
