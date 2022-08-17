import { BalanceToken } from './balance.token.entity';

export interface Balance {
  tokenAddress?: string;
  token?: BalanceToken;
  balance: bigint;
  fiatBalance: number;
  fiatConversion: number;
}
