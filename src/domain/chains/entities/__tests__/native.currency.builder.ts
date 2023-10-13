import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';

export function nativeCurrencyBuilder(): IBuilder<NativeCurrency> {
  return Builder.new<NativeCurrency>()
    .with('name', faker.finance.currencyName())
    .with('symbol', faker.finance.currencySymbol())
    .with('decimals', 18)
    .with('logoUri', faker.internet.url({ appendSlash: false }));
}
