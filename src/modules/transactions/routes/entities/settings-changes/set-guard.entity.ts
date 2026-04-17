import { ApiProperty } from '@nestjs/swagger';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';

export class SetGuard extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.SetGuard] })
  declare type: SettingsChangeType.SetGuard;

  @ApiProperty()
  guard: AddressInfo;

  constructor(guard: AddressInfo) {
    super(SettingsChangeType.SetGuard);
    this.guard = guard;
  }
}
