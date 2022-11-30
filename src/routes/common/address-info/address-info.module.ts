import { Module } from '@nestjs/common';
import { AddressInfoHelper } from './address-info.helper';

@Module({
  providers: [AddressInfoHelper],
  exports: [AddressInfoHelper],
})
export class AddressInfoModule {}
