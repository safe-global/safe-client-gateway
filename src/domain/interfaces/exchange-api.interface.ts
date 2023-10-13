import { ExchangeFiatCodes } from '@/domain/exchange/entities/exchange-fiat-codes.entity';
import { ExchangeRates } from '@/domain/exchange/entities/exchange-rates.entity';

export const IExchangeApi = Symbol('IExchangeApi');

export interface IExchangeApi {
  getFiatCodes(): Promise<ExchangeFiatCodes>;
  getRates(): Promise<ExchangeRates>;
}
