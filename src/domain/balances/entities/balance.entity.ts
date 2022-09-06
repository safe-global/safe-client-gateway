import { BalanceToken } from './balance.token.entity';

export interface Balance {
  tokenAddress?: string;
  token?: BalanceToken;
  balance: number;
  fiatBalance: number;
  fiatConversion: number;
}
