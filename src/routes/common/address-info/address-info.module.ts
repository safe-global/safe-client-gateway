import { Module } from '@nestjs/common';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { ContractsRepositoryModule } from '@/domain/contracts/contracts.repository.interface';
import { TokenRepositoryModule } from '@/domain/tokens/token.repository.interface';

@Module({
  imports: [ContractsRepositoryModule, TokenRepositoryModule],
  providers: [AddressInfoHelper],
  exports: [AddressInfoHelper],
})
export class AddressInfoModule {}
