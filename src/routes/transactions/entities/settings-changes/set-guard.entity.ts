import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/routes/transactions/entities/settings-changes/settings-change.entity';

export class SetGuard extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.SetGuard] })
  override type!: SettingsChangeType.SetGuard;

  @ApiProperty()
  guard: AddressInfo;

  constructor(guard: AddressInfo) {
    super(SettingsChangeType.SetGuard);
    this.guard = guard;
  }
}
