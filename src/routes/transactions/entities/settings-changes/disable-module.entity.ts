import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { SettingsChange } from './settings-change.entity';

export class DisableModule extends SettingsChange {
  @ApiProperty()
  module: AddressInfo;

  constructor(module: AddressInfo) {
    super('DISABLE_MODULE');
    this.module = module;
  }
}
