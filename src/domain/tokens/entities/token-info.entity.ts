export enum TokenType {
  Erc721 = 'ERC721',
  Erc20 = 'ERC20',
  NativeToken = 'NATIVE_TOKEN',
  Unknown = 'UNKNOWN',
}

export interface TokenInfo {
  address: string;
  decimals: number;
  logoUri: string;
  name: string;
  symbol: string;
  tokenType: TokenType;
}
