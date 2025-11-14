import type { Balance } from '@/modules/balances/domain/entities/balance.entity';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Collectible } from '@/modules/collectibles/domain/entities/collectible.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Address } from 'viem';

export interface IBalancesApi {
  getBalances(args: {
    safeAddress: Address;
    fiatCode: string;
    chain: Chain;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Raw<Array<Balance>>>;

  getBalance(args: {
    safeAddress: Address;
    fiatCode: string;
    chain: Chain;
    tokenAddress: Address;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Raw<Balance> | null>;

  clearBalances(args: { chainId: string; safeAddress: Address }): Promise<void>;

  getCollectibles(args: {
    safeAddress: Address;
    chain: Chain;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Raw<Page<Collectible>>>;

  clearCollectibles(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  getFiatCodes(): Promise<Raw<Array<string>>>;
}
