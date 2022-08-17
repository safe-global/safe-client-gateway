import { Balance } from '../balance.entity';
import { faker } from '@faker-js/faker';
import balanceTokenFactory from './balance.token.factory';
import { BalanceToken } from '../balance.token.entity';

export default function factory(size?: number): Balance[] {
  return [...Array(size ?? 1).keys()].map(() => balanceFactory());
}

export function balanceFactory(
  tokenAddress?: string,
  token?: BalanceToken,
  balance?: bigint,
  fiatBalance?: number,
  fiatConversion?: number,
): Balance {
  return <Balance>{
    tokenAddress: tokenAddress || faker.finance.ethereumAddress(),
    token: token || balanceTokenFactory(),
    balance: balance || faker.datatype.bigInt(),
    fiatBalance: fiatBalance || faker.datatype.number(),
    fiatConversion: fiatConversion || faker.datatype.number(),
  };
}
