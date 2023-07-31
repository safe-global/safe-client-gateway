import { Page } from '../entities/page.entity';
import { Collectible } from './entities/collectible.entity';

export const IChainsRepository = Symbol('IChainsRepository');

export const ICollectiblesRepository = Symbol('ICollectiblesRepository');

export interface ICollectiblesRepository {
  getCollectibles(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>>;

  clearCollectibles(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;
}
