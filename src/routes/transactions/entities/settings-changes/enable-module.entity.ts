import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { SettingsChange } from './settings-change.entity';

export class EnableModule extends SettingsChange {
  @ApiProperty()
  module: AddressInfo;

  constructor(module: AddressInfo) {
    super('ENABLE_MODULE');
    this.module = module;
  }
}
