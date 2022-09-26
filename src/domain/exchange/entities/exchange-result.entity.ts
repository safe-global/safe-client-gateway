export interface ExchangeResult {
  success: boolean;
  rates: Record<string, number>;
  base: string;
}
