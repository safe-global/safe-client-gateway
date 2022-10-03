import { RatesExchangeResult } from '../rates-exchange-result.entity';

export default function (
  success?: boolean,
  rates?: Record<string, number>,
  base?: string,
): RatesExchangeResult {
  return <RatesExchangeResult>{
    success: success ?? true,
    base: base ?? 'EUR',
    rates: rates ?? { USD: 1.5 },
  };
}
