import { Balance } from '@/domain/balances/entities/balance.entity';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { Page } from '@/domain/entities/page.entity';

export interface IBalancesApi {
  getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
  }): Promise<Balance[]>;

  clearBalances(args: { chainId: string; safeAddress: string }): Promise<void>;

  getCollectibles(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Collectible>>;

  clearCollectibles(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;

  getFiatCodes(): string[];
}
