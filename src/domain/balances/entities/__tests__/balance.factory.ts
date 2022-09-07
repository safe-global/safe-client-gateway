import { Balance } from '../balance.entity';
import { faker } from '@faker-js/faker';
import balanceTokenFactory from './balance.token.factory';
import { BalanceToken } from '../balance.token.entity';

export function balanceFactory(
  tokenAddress?: string,
  token?: BalanceToken,
  balance?: number,
  fiatBalance?: number,
  fiatConversion?: number,
): Balance {
  return <Balance>{
    tokenAddress: tokenAddress || faker.finance.ethereumAddress(),
    token: token || balanceTokenFactory(),
    balance: balance || faker.datatype.number(),
    fiatBalance: fiatBalance || faker.datatype.number(),
    fiatConversion: fiatConversion || faker.datatype.number(),
  };
}
