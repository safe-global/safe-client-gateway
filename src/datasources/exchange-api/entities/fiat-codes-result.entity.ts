export interface FiatCodesExchangeResult {
  success: boolean;
  // TODO: use Record<string, string>, define a compatible JSONSchema
  symbols: object;
}
