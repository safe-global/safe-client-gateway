import { Page } from './entities/page.entity';
import { Chain } from './entities/chain.entity';
import { Balance } from './entities/balance.entity';
import { Backbone } from '../chains/entities';

export const IDomainRepository = Symbol('IDomainRepository');

export interface IDomainRepository {
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
   * Gets the collection of {@link Balance} associated with {@link safeAddress}
   * on {@link chainId}
   *
   * @param chainId
   * @param safeAddress
   * @param trusted - filters trusted tokens
   * @param excludeSpam - excludes tokens marked as spam
   */
  getBalances(
    chainId: string,
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]>;

  /**
   * Gets the Safe Transaction Service configuration for {@link chainId}
   * @param chainId
   */
  getBackbone(chainId: string): Promise<Backbone>;

  /**
   * Gets the conversion rate between the currencies {@link to} and {@link from}
   * @param to
   * @param from
   */
  convertRates(to: string, from: string): Promise<number>;

  /**
   * Gets the available fiat codes
   */
  getFiatCodes(): Promise<string[]>;
}
