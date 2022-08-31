import { faker } from '@faker-js/faker';
import { NativeCurrency } from '../../../../chains/entities';

export default function (
  name?: string,
  symbol?: string,
  decimals?: number,
  logoUri?: string,
): NativeCurrency {
  return <NativeCurrency>{
    name: name ?? faker.finance.currencyName(),
    symbol: symbol ?? faker.finance.currencySymbol(),
    decimals: decimals ?? 18,
    logoUri: logoUri ?? faker.internet.url(),
  };
}
