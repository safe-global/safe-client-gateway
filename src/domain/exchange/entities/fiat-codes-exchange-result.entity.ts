import { ExchangeResult } from "./exchange-result.entity";

export interface FiatCodesExchangeResult extends ExchangeResult {
  // TODO: use Record<string, string>, define a compatible JSONSchema
  symbols: object;
}
