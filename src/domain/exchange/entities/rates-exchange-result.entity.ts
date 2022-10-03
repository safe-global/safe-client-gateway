export class RatesExchangeResult {
  // TODO: use Record<string, number>, define a compatible JSONSchema
  success: boolean;
  rates: object;
  base: string;
}
