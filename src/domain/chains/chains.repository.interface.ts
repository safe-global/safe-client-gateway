import { Chain } from '@/domain/chains/entities/chain.entity';
import { Singleton } from '@/domain/chains/entities/singleton.entity';
import { Page } from '@/domain/entities/page.entity';

export const IChainsRepository = Symbol('IChainsRepository');

export interface IChainsRepository {
  /**
   * Gets a collection of {@link Chain} in a paginated format
   *
   * @param limit - the amount of chains to retrieve per {@link Page}
   * @param offset - the starting point for the pagination
   */
  getChains(limit?: number, offset?: number): Promise<Page<Chain>>;

  /**
   * Gets the {@link Chain} associated with {@link chainId}
   *
   * @param chainId
   */
  getChain(chainId: string): Promise<Chain>;

  /**
   * Triggers the removal of the chain data stored in the DataSource (e.g. cache)
   */
  clearChain(chainId: string): Promise<void>;

  /**
   * Gets the supported {@link Singleton} associated with {@link chainId}
   *
   * @param chainId
   */
  getSingletons(chainId: string): Promise<Singleton[]>;
}
