import { ExchangeRates } from '../exchange/entities/exchange-rates.entity';
import { ExchangeFiatCodes } from '../exchange/entities/exchange-fiat-codes.entity';

export const IExchangeApi = Symbol('IExchangeApi');

export interface IExchangeApi {
  getFiatCodes(): Promise<ExchangeFiatCodes>;
  getRates(): Promise<ExchangeRates>;
}
