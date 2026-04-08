// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';

export class AddOwner extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.AddOwner] })
  declare readonly type: SettingsChangeType.AddOwner;

  @ApiProperty()
  owner: AddressInfo;
  @ApiProperty()
  threshold: number;

  constructor(owner: AddressInfo, threshold: number) {
    super(SettingsChangeType.AddOwner);
    this.owner = owner;
    this.threshold = threshold;
  }
}
