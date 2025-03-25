import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/routes/transactions/entities/settings-changes/settings-change.entity';

export class DisableModule extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.DisableModule] })
  override type!: SettingsChangeType.DisableModule;

  @ApiProperty()
  module: AddressInfo;

  constructor(module: AddressInfo) {
    super(SettingsChangeType.DisableModule);
    this.module = module;
  }
}
