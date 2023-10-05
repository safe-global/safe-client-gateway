import { BalanceToken } from '@/domain/balances/entities/balance.token.entity';

/**
 * @deprecated to be removed after Coingecko prices retrieval is complete.
 */
export interface Balance {
  tokenAddress: string | null;
  token: BalanceToken | null;
  balance: string;
  fiatBalance: string;
  fiatConversion: string;
}
