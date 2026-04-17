import { ApiProperty } from '@nestjs/swagger';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';

export class EnableModule extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.EnableModule] })
  declare type: SettingsChangeType.EnableModule;

  @ApiProperty()
  module: AddressInfo;

  constructor(module: AddressInfo) {
    super(SettingsChangeType.EnableModule);
    this.module = module;
  }
}
