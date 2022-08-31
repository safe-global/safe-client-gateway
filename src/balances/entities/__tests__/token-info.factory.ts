import { faker } from '@faker-js/faker';
import { TokenInfo } from '../../../common/entities/token-info.entity';
import { TokenType } from '../../../common/entities/token-type.entity';

export default function (
  tokenType?: TokenType,
  address?: string,
  decimals?: number,
  symbol?: string,
  name?: string,
  logoUri?: string,
): TokenInfo {
  return <TokenInfo>{
    tokenType: tokenType ?? TokenType.Erc20,
    address: address ?? faker.finance.ethereumAddress(),
    decimals: decimals ?? faker.datatype.number(32),
    symbol: symbol ?? faker.finance.currencySymbol(),
    name: name ?? faker.random.word(),
    logoUri: logoUri ?? faker.internet.url(),
  };
}
