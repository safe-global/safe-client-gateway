import { faker } from '@faker-js/faker';
import { Token, TokenType } from '../entities/token.entity';

export default function (
  address?: string,
  decimals?: number | null,
  logoUri?: string,
  name?: string,
  symbol?: string,
  type?: TokenType,
): Token {
  return <Token>{
    address: address ?? faker.finance.ethereumAddress(),
    decimals: decimals === undefined ? faker.datatype.number() : decimals,
    logoUri: logoUri ?? faker.internet.url(),
    name: name ?? faker.random.word(),
    symbol: symbol ?? faker.finance.currencySymbol(),
    type: type ?? TokenType.Erc20,
  };
}
