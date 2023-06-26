import { faker } from '@faker-js/faker';
import { NativeCurrency } from '../native.currency.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function nativeCurrencyBuilder(): IBuilder<NativeCurrency> {
  return Builder.new<NativeCurrency>()
    .with('name', faker.finance.currencyName())
    .with('symbol', faker.finance.currencySymbol())
    .with('decimals', 18)
    .with('logoUri', faker.internet.url({ appendSlash: false }));
}
