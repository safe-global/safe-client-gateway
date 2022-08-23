import { FiatCodesExchangeResult } from '../fiat-codes-result.entity';

export default function (
  success?: boolean,
  symbols?: Record<string, string>,
): FiatCodesExchangeResult {
  return <FiatCodesExchangeResult>{
    success: success ?? true,
    symbols: symbols ?? {
      AED: 'United Arab Emirates Dirham',
      USD: 'United States Dollar',
      AFN: 'Afghan Afghani',
      EUR: 'Euro',
      ALL: 'Albanian Lek',
    },
  };
}
