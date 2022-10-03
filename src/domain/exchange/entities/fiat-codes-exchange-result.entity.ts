export interface FiatCodesExchangeResult {
  // TODO: use Record<string, string>, define a compatible JSONSchema
  success: boolean;
  symbols: object;
}
