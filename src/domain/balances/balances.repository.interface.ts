import { Balance } from './entities/balance.entity';

export const IBalancesRepository = Symbol('IBalancesRepository');

export interface IBalancesRepository {
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
}
