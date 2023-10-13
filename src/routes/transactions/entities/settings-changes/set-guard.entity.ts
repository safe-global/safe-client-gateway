import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { SettingsChange } from '@/routes/transactions/entities/settings-changes/settings-change.entity';

export class SetGuard extends SettingsChange {
  @ApiProperty()
  guard: AddressInfo;

  constructor(guard: AddressInfo) {
    super('SET_GUARD');
    this.guard = guard;
  }
}
