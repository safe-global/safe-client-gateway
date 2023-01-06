import { ExchangeRates } from '../exchange-rates.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function exchangeRatesBuilder(): IBuilder<ExchangeRates> {
  return Builder.new<ExchangeRates>()
    .with('success', true)
    .with('base', 'EUR')
    .with('rates', { USD: 1.5 });
}
