import { faker } from '@faker-js/faker';
import { TokenInfo } from '../../../common/entities/token-info.entity';
import { Balance } from '../balance.entity';
import tokenInfoFactory from './token-info.factory';

export default function (
  tokenInfo?: TokenInfo,
  balance?: number,
  token?: string,
  fiatBalance?: number,
  fiatConversion?: number,
): Balance {
  return <Balance>{
    tokenInfo: tokenInfo ?? tokenInfoFactory(),
    balance: balance ?? faker.datatype.number({ precision: 0.01 }).toString(),
    token: token ?? faker.random.word(),
    fiatBalance: fiatBalance ?? faker.datatype.number({ precision: 0.01 }),
    fiatConversion: fiatConversion ?? faker.datatype.number(),
  };
}
