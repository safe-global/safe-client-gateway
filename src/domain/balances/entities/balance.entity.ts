import { BalanceToken } from '@/domain/balances/entities/balance.token.entity';

export interface Balance {
  tokenAddress: string | null;
  token: BalanceToken | null;
  balance: string;
  fiatBalance: string | null;
  fiatConversion: string | null;
}
