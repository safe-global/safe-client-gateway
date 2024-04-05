import { Balance } from '@/domain/balances/entities/balance.entity';
import { Module } from '@nestjs/common';
import { BalancesRepository } from '@/domain/balances/balances.repository';
import { BalancesApiModule } from '@/datasources/balances-api/balances-api.module';

export const IBalancesRepository = Symbol('IBalancesRepository');

export interface IBalancesRepository {
  /**
   * Gets the collection of {@link Balance} associated with {@link safeAddress}
   * on {@link chainId}
   */
  getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]>;

  /**
   * Clears any stored local balance data of {@link safeAddress} on {@link chainId}
   */
  clearBalances(args: { chainId: string; safeAddress: string }): Promise<void>;

  /**
   * Gets the list of supported fiat codes.
   * @returns an alphabetically ordered list of uppercase strings representing the supported fiat codes.
   */
  getFiatCodes(): Promise<string[]>;
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
