import { Module } from '@nestjs/common';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { ContractsModule } from '@/modules/contracts/contracts.module';
import { TokensModule } from '@/modules/tokens/tokens.module';

@Module({
  imports: [ContractsModule, TokensModule],
  providers: [AddressInfoHelper],
  exports: [AddressInfoHelper],
})
export class AddressInfoModule {}
