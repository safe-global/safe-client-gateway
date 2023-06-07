import { Page } from '../entities/page.entity';
import { Collectible } from './entities/collectible.entity';

export const IChainsRepository = Symbol('IChainsRepository');

export const ICollectiblesRepository = Symbol('ICollectiblesRepository');

export interface ICollectiblesRepository {
  getCollectibles(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Page<Collectible>>;

  clearCollectibles(chainId: string, safeAddress: string): Promise<void>;
}
