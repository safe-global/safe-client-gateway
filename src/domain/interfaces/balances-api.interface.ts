import { Balance } from '@/domain/balances/entities/balance.entity';

export interface IBalancesApi {
  getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
  }): Promise<Balance[]>;

  clearBalances(args: { chainId: string; safeAddress: string }): Promise<void>;

  getFiatCodes(): string[];
}
