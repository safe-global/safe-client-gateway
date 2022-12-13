import { BalanceToken } from './balance.token.entity';

export interface Balance {
  tokenAddress: string | null;
  token: BalanceToken | null;
  balance: string;
  fiatBalance: string;
  fiatConversion: string;
}
