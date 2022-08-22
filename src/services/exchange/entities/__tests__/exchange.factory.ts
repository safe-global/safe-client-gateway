import { ExchangeResult } from '../exchange.entity';

export default function (
  success?: boolean,
  rates?: Record<string, number>,
  base?: string,
): ExchangeResult {
  return <ExchangeResult>{
    success: success ?? true,
    base: base ?? 'EUR',
    rates: rates ?? { USD: 1.5 },
  };
}
