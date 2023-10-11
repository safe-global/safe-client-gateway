import { Module } from '@nestjs/common';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';

@Module({
  providers: [AddressInfoHelper],
  exports: [AddressInfoHelper],
})
export class AddressInfoModule {}
