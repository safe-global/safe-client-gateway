import { Balance } from './entities/balance.entity';

export const IBalancesRepository = Symbol('IBalancesRepository');

export interface IBalancesRepository {
  /**
   * Gets the collection of {@link Balance} associated with {@link safeAddress}
   * on {@link chainId}
   */
  getBalances(args: {
    chainId: string;
    safeAddress: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]>;

  /**
   * Clears any stored local balance data of {@link safeAddress} on {@link chainId}
   */
  clearLocalBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;
}
