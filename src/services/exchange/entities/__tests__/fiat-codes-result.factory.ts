import { FiatCodesExchangeResult } from '../fiat-codes-result.entity';

export default function (
  success?: boolean,
  symbols?: string[],
): FiatCodesExchangeResult {
  return <FiatCodesExchangeResult>{
    success: success ?? true,
    symbols: symbols ?? ['AED', 'AFN', 'EUR', 'ALL', 'USD'],
  };
}
