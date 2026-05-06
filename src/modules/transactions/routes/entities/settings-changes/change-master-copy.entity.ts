// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';

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
