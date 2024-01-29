import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';

export const IBalancesApiManager = Symbol('IBalancesApiManager');

export interface IBalancesApiManager {
  /**
   * Determines whether an external balances provider is being used
   * for a given chain ID.
   *
   * @param chainId - the chain identifier to check.
   * @returns true if the chain balances are externalized.
   */
  useExternalApi(chainId: string): boolean;

  /**
   * Gets an {@link IBalancesApi} implementation.
   * Each chain is associated to an implementation (i.e.: to a balances
   * provider) via configuration.
   *
   * @param chainId - the chain identifier to check.
   * @returns {@link IBalancesApi} configured for the input chain ID.
   */
  getBalancesApi(chainId: string): IBalancesApi;
}
