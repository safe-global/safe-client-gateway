import { ExchangeRates } from '../exchange-rates.entity';

export default function (
  success?: boolean,
  rates?: Record<string, number>,
  base?: string,
): ExchangeRates {
  return <ExchangeRates>{
    success: success ?? true,
    base: base ?? 'EUR',
    rates: rates ?? { USD: 1.5 },
  };
}
