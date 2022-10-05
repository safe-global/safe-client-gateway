import { RatesExchangeResult } from '../exchange/entities/rates-exchange-result.entity';
import { FiatCodesExchangeResult } from '../exchange/entities/fiat-codes-exchange-result.entity';

export const IExchangeApi = Symbol('IExchangeApi');

export interface IExchangeApi {
  getFiatCodes(): Promise<FiatCodesExchangeResult>;
  getRates(): Promise<RatesExchangeResult>;
}
