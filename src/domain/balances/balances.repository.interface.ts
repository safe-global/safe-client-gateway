import { Balance } from '@/domain/balances/entities/balance.entity';
import { SimpleBalance } from '@/domain/balances/entities/simple-balance.entity';

export const IBalancesRepository = Symbol('IBalancesRepository');

export interface IBalancesRepository {
  /**
   * Gets the collection of {@link Balance} associated with {@link safeAddress}
   * on {@link chainId}
   * @deprecated to be removed after Coingecko prices retrieval is complete.
   */
  getBalances(args: {
    chainId: string;
    safeAddress: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]>;

  /**
   * Gets the collection of {@link Balance} associated with {@link safeAddress}
   * on {@link chainId}
   */
  getSimpleBalances(args: {
    chainId: string;
    safeAddress: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<SimpleBalance[]>;

  /**
   * Clears any stored local balance data of {@link safeAddress} on {@link chainId}
   */
  clearLocalBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;
}
