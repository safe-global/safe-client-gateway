export interface RatesExchangeResult {
  success: boolean;
  rates: Record<string, number>;
  base: string;
}
