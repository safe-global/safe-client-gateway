export interface ExchangeRates {
  success: boolean;
  rates: Record<string, number>;
  base: string;
}
