// TODO: use ExchangeResult as parent and extend with FiatCodesExchangeResult and RatesExchangeResult
export interface ExchangeResult {
  success: boolean;
  // TODO: use Record<string, number>, define a compatible JSONSchema
  rates: object;
  base: string;
}
