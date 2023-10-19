import { Builder, IBuilder } from '@/__tests__/builder';
import { ExchangeRates } from '@/domain/exchange/entities/exchange-rates.entity';

export function exchangeRatesBuilder(): IBuilder<ExchangeRates> {
  return Builder.new<ExchangeRates>()
    .with('success', true)
    .with('base', 'EUR')
    .with('rates', { USD: 1.5 });
}
