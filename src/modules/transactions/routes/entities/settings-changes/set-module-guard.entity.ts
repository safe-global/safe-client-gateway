// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';

export class SetModuleGuard extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.SetModuleGuard] })
  declare type: SettingsChangeType.SetModuleGuard;

  @ApiProperty()
  moduleGuard: AddressInfo;

  constructor(moduleGuard: AddressInfo) {
    super(SettingsChangeType.SetModuleGuard);
    this.moduleGuard = moduleGuard;
  }
}
