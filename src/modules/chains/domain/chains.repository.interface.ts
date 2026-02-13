import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Singleton } from '@/modules/chains/domain/entities/singleton.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { IndexingStatus } from '@/modules/indexing/domain/entities/indexing-status.entity';
import type { GasPriceResponse } from '@/modules/chains/routes/entities/gas-price-response.entity';

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
   * Gets all the {@link Chain} available across pages
   */
  getAllChains(): Promise<Array<Chain>>;

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
   * Gets a collection of {@link Chain} in a paginated format using Config Service v2
   * with service-scoped feature configuration
   *
   * @param serviceKey - the service key for scoping chain features
   * @param limit - the amount of chains to retrieve per {@link Page}
   * @param offset - the starting point for the pagination
   */
  getChainsV2(
    serviceKey: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Chain>>;

  /**
   * Gets the {@link Chain} associated with {@link chainId} using Config Service v2
   * with service-scoped feature configuration
   *
   * @param serviceKey - the service key for scoping chain features
   * @param chainId
   */
  getChainV2(serviceKey: string, chainId: string): Promise<Chain>;

  /**
   * Triggers the removal of the v2 chain data stored in the DataSource (e.g. cache)
   * for a specific service key
   *
   * @param chainId
   * @param serviceKey
   */
  clearChainV2(chainId: string, serviceKey: string): Promise<void>;

  /**
   * Gets the supported {@link Singleton} associated with {@link chainId}
   *
   * @param chainId
   */
  getSingletons(chainId: string): Promise<Array<Singleton>>;

  /**
   * Gets the {@link IndexingStatus} associated with {@link chainId}
   *
   * @param chainId
   */
  getIndexingStatus(chainId: string): Promise<IndexingStatus>;

  /**
   * Checks if the {@link Chain} associated with {@link chainId} is supported.
   *
   * @param chainId
   */
  isSupportedChain(chainId: string): Promise<boolean>;

  /**
   * Gets the gas price from Etherscan for the given chain.
   *
   * @param chainId
   */
  getGasPrice(chainId: string): Promise<GasPriceResponse>;
}
