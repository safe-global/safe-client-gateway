import { Balance } from '../balance.entity';
import { faker } from '@faker-js/faker';
import balanceTokenFactory from './balance.token.factory';
import { BalanceToken } from '../balance.token.entity';

export function balanceFactory(
  tokenAddress?: string,
  token?: BalanceToken,
  balance?: string,
  fiatBalance?: string,
  fiatConversion?: string,
): Balance {
  return <Balance>{
    tokenAddress: tokenAddress ?? faker.finance.ethereumAddress(),
    token: token ?? balanceTokenFactory(),
    balance: balance ?? faker.random.numeric(),
    fiatBalance: fiatBalance ?? faker.random.numeric(),
    fiatConversion: fiatConversion ?? faker.random.numeric(),
  };
}
