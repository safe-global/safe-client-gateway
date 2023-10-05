import { BalanceToken } from './balance.token.entity';

export interface SimpleBalance {
  tokenAddress: string | null;
  token: BalanceToken | null;
  balance: string;
}
