import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { SettingsChange } from './settings-change.entity';

export class ChangeMasterCopy extends SettingsChange {
  @ApiProperty()
  implementation: AddressInfo;

  constructor(implementation: AddressInfo) {
    super('CHANGE_MASTER_COPY');
    this.implementation = implementation;
  }
}
