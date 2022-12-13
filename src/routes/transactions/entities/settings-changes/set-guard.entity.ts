import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { SettingsChange } from './settings-change.entity';

export class SetGuard extends SettingsChange {
  @ApiProperty()
  guard: AddressInfo;

  constructor(guard: AddressInfo) {
    super('SET_GUARD');
    this.guard = guard;
  }
}
