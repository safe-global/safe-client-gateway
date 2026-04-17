// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ContractsModule } from '@/modules/contracts/contracts.module';
import { TokensModule } from '@/modules/tokens/tokens.module';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';

@Module({
  imports: [ContractsModule, TokensModule],
  providers: [AddressInfoHelper],
  exports: [AddressInfoHelper],
})
export class AddressInfoModule {}
