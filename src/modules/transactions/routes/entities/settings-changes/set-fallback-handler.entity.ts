// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';

export class SetFallbackHandler extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.SetFallbackHandler] })
  declare type: SettingsChangeType.SetFallbackHandler;

  @ApiProperty()
  handler: AddressInfo;

  constructor(handler: AddressInfo) {
    super(SettingsChangeType.SetFallbackHandler);
    this.handler = handler;
  }
}
