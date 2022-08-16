import { TokenType } from './tokentype.entity';

export interface TokenInfo {
  tokenType: TokenType;
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  logoUri?: string;
}
