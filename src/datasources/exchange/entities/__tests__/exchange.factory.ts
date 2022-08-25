import { ExchangeResult } from '../exchange.entity';

export default function (
  rates?: Record<string, number>,
  base?: string,
): ExchangeResult {
  return <ExchangeResult>{
    base: base ?? 'EUR',
    rates: rates ?? { USD: 1.5 },
  };
}
