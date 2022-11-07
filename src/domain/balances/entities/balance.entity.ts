import { BalanceToken } from './balance.token.entity';

export interface Balance {
  tokenAddress?: string;
  token?: BalanceToken;
  balance: string;
  fiatBalance: string;
  fiatConversion: string;
}
