import { ExchangeResult } from "./exchange-result.entity";

export interface RatesExchangeResult extends ExchangeResult {
  // TODO: use Record<string, number>, define a compatible JSONSchema
  rates: object;
  base: string;
}
