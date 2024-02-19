import { Balance } from '@/domain/balances/entities/balance.entity';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { Page } from '@/domain/entities/page.entity';

export interface IBalancesApi {
  getBalances(args: {
    safeAddress: string;
    fiatCode?: string;
    chainId?: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]>;

  clearBalances(args: { chainId: string; safeAddress: string }): Promise<void>;

  getCollectibles(args: {
    safeAddress: string;
    chainId?: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>>;

  clearCollectibles(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;

  getFiatCodes(): Promise<string[]>;
}
