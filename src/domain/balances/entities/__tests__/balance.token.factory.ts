import { BalanceToken } from '../balance.token.entity';
import { faker } from '@faker-js/faker';

export default function (
  decimals?: number,
  logo_uri?: string,
  name?: string,
  symbol?: string,
): BalanceToken {
  return <BalanceToken>{
    decimals: decimals || faker.datatype.number(),
    logoUri: logo_uri || faker.internet.url(),
    name: name || faker.finance.currencyName(),
    symbol: symbol || faker.finance.currencySymbol(),
  };
}
