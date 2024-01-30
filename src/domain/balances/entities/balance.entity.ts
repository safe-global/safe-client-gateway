import { BalanceToken } from '@/domain/balances/entities/balance.token.entity';

export interface NativeBalance {
  tokenAddress: null;
  token: null;
  balance: string;
}

export interface Erc20Balance {
  tokenAddress: string;
  token: BalanceToken;
  balance: string;
}

export type Balance = (NativeBalance | Erc20Balance) & {
  fiatBalance: string | null;
  fiatConversion: string | null;
};
