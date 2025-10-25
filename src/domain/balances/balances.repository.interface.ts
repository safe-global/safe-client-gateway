import { Balance } from '@/domain/balances/entities/balance.entity';
import { Module } from '@nestjs/common';
import { BalancesRepository } from '@/domain/balances/balances.repository';
import { BalancesApiModule } from '@/datasources/balances-api/balances-api.module';
import { Chain } from '@/domain/chains/entities/chain.entity';
import type { Address } from 'viem';

export const IBalancesRepository = Symbol('IBalancesRepository');

export interface IBalancesRepository {
  /**
   * Gets the collection of {@link Balance} associated with {@link safeAddress}
   * on {@link chainId}
   * @param args - The arguments object
   * @param args.chain - The chain information
   * @param args.safeAddress - The Safe address to get balances for
   * @param args.fiatCode - The fiat currency code for conversion
   * @param args.trusted - Whether to include only trusted tokens (optional)
   * @param args.excludeSpam - Whether to exclude spam tokens (optional)
   * @returns Promise that resolves to an array of Balance objects
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
   * @param args - The arguments object
   * @param args.chain - The chain information
   * @param args.safeAddress - The Safe address to get token balance for
   * @param args.fiatCode - The fiat currency code for conversion
   * @param args.tokenAddress - The specific token address to get balance for
   * @param args.trusted - Whether to include only trusted tokens (optional)
   * @param args.excludeSpam - Whether to exclude spam tokens (optional)
   * @returns Promise that resolves to a Balance object or null if not found
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
   */
  clearBalances(args: { chainId: string; safeAddress: Address }): Promise<void>;

  /**
   * Gets the list of supported fiat codes.
   * @returns an alphabetically ordered list of uppercase strings representing the supported fiat codes.
   */
  getFiatCodes(): Promise<Array<string>>;

  /**
   * Clears the API associated with {@link chainId}
   */
  clearApi(chainId: string): void;
}

@Module({
  imports: [BalancesApiModule],
  providers: [
    {
      provide: IBalancesRepository,
      useClass: BalancesRepository,
    },
  ],
  exports: [IBalancesRepository],
})
export class BalancesRepositoryModule {}
