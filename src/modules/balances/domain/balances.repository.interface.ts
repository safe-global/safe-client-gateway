import type { Balance } from '@/modules/balances/domain/entities/balance.entity';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Address } from 'viem';

export const IBalancesRepository = Symbol('IBalancesRepository');

export interface IBalancesRepository {
  /**
   * Gets the collection of {@link Balance} associated with {@link safeAddress}
   * on {@link chainId}
   * @param {object} args - The arguments object
   * @param {Chain} args.chain - The chain information
   * @param {Address} args.safeAddress - The Safe address to get balances for
   * @param {string} args.fiatCode - The fiat currency code for conversion
   * @param {boolean} args.trusted - Whether to include only trusted tokens (optional)
   * @param {boolean} args.excludeSpam - Whether to exclude spam tokens (optional)
   * @returns {Promise<Array<Balance>>} Promise that resolves to an array of Balance objects
   */
  getBalances(args: {
    chain: Chain;
    safeAddress: Address;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Array<Balance>>;

  /**
   * Gets the balance of token associated with {@link safeAddress}
   * on {@link chainId}
   * @param {object} args - The arguments object
   * @param {Chain} args.chain - The chain information
   * @param {Address} args.safeAddress - The Safe address to get token balance for
   * @param {string} args.fiatCode - The fiat currency code for conversion
   * @param {Address} args.tokenAddress - The specific token address to get balance for
   * @param {boolean} args.trusted - Whether to include only trusted tokens (optional)
   * @param {boolean} args.excludeSpam - Whether to exclude spam tokens (optional)
   * @returns {Promise<Balance | null>} Promise that resolves to a Balance object or null if not found
   */
  getTokenBalance(args: {
    chain: Chain;
    safeAddress: Address;
    fiatCode: string;
    tokenAddress: Address;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance | null>;

  /**
   * Clears any stored local balance data of {@link safeAddress} on {@link chainId}
   * @param {object} args - The arguments object
   * @param {string} args.chainId - The chain identifier
   * @param {Address} args.safeAddress - The Safe address to clear balances for
   * @returns {Promise<void>} Promise that resolves when balances are cleared
   */
  clearBalances(args: { chainId: string; safeAddress: Address }): Promise<void>;

  /**
   * Gets the list of supported fiat codes.
   * @returns an alphabetically ordered list of uppercase strings representing the supported fiat codes.
   */
  getFiatCodes(): Promise<Array<string>>;

  /**
   * Clears the API associated with {@link chainId}
   * @param {string} chainId - The chain identifier
   * @returns {void}
   */
  clearApi(chainId: string): void;
}
