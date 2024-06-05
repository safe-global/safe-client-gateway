import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';

export const IBalancesApiManager = Symbol('IBalancesApiManager');

export interface IBalancesApiManager {
  /**
   * Gets an {@link IBalancesApi} implementation.
   * Each chain is associated with an implementation (i.e.: to a balances
   * provider) via configuration.
   *
   * Note: if the Safe entity associated with the passed safeAddress cannot be retrieved
   * by the TransactionApi for the input chain ID, then the Zerion API will be used.
   *
   * @param chainId - the chain identifier to check.
   * @param safeAddress - the safe address to check.
   * @returns {@link IBalancesApi} configured for the input chain ID.
   */
  getBalancesApi(
    chainId: string,
    safeAddress: `0x${string}`,
  ): Promise<IBalancesApi>;

  /**
   * Gets the list of supported fiat codes.
   * @returns an alphabetically ordered list of uppercase strings representing the supported fiat codes.
   */
  getFiatCodes(): Promise<string[]>;
}
