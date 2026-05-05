// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';

export class DisableModule extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.DisableModule] })
  declare type: SettingsChangeType.DisableModule;

  @ApiProperty()
  module: AddressInfo;

  constructor(module: AddressInfo) {
    super(SettingsChangeType.DisableModule);
    this.module = module;
  }
}
