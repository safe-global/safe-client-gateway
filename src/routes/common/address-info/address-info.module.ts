import { Module } from '@nestjs/common';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { ContractsRepositoryModule } from '@/modules/contracts/domain/contracts.repository.interface';
import { TokenRepositoryModule } from '@/modules/tokens/domain/token.repository.interface';

@Module({
  imports: [ContractsRepositoryModule, TokenRepositoryModule],
  providers: [AddressInfoHelper],
  exports: [AddressInfoHelper],
})
export class AddressInfoModule {}
