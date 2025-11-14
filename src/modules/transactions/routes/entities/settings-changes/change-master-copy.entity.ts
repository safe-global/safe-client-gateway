import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';

export class ChangeMasterCopy extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.ChangeMasterCopy] })
  declare type: SettingsChangeType.ChangeMasterCopy;

  @ApiProperty()
  implementation: AddressInfo;

  constructor(implementation: AddressInfo) {
    super(SettingsChangeType.ChangeMasterCopy);
    this.implementation = implementation;
  }
}
