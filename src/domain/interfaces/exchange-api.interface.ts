import { ExchangeResult } from "../exchange/entities/exchange-result.entity";
import { FiatCodesExchangeResult } from "../exchange/entities/fiat-codes-result.entity";

export const IExchangeApi = Symbol('IExchangeApi');

export interface IExchangeApi {
  getFiatCodes(): Promise<FiatCodesExchangeResult>;
  getExchangeResult(): Promise<ExchangeResult>;
}
