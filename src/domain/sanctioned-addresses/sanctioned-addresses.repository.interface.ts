import { CacheModule } from '@/datasources/cache/cache.module';
import { SanctionedAddressesRepository } from '@/domain/sanctioned-addresses/sanctioned-addresses.repository';
import { Module } from '@nestjs/common';

export const ISanctionedAddressesRepository = Symbol(
  'ISanctionedAddressesRepository',
);

export interface ISanctionedAddressesRepository {
  /**
   * Gets the list of sanctioned addresses
   * @returns an array of strings representing the sanctioned addresses
   */
  getSanctionedAddresses(): Promise<Array<`0x${string}`>>;
}

@Module({
  imports: [CacheModule],
  providers: [
    {
      provide: ISanctionedAddressesRepository,
      useClass: SanctionedAddressesRepository,
    },
  ],
  exports: [ISanctionedAddressesRepository],
})
export class SanctionedAddressesRepositoryModule {}
