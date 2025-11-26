import type { Collectible } from '@/modules/collectibles/domain/entities/collectible.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Address } from 'viem';

export const ICollectiblesRepository = Symbol('ICollectiblesRepository');

export interface ICollectiblesRepository {
  getCollectibles(args: {
    chain: Chain;
    safeAddress: Address;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>>;

  clearCollectibles(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;
}
