import { ISanctionedAddressesRepository } from '@/domain/sanctioned-addresses/sanctioned-addresses.repository.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SanctionedAddressesService {
  constructor(
    @Inject(ISanctionedAddressesRepository)
    private readonly sanctionedAddressesRepository: ISanctionedAddressesRepository,
  ) {}

  async getSanctionedAddresses(): Promise<Array<`0x${string}`>> {
    return this.sanctionedAddressesRepository.getSanctionedAddresses();
  }
}
