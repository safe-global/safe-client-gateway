import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { SettingsChange } from './settings-change.entity';

export class RemoveOwner extends SettingsChange {
  @ApiProperty()
  owner: AddressInfo;
  @ApiProperty()
  threshold: number;

  constructor(owner: AddressInfo, threshold: number) {
    super('REMOVE_OWNER');
    this.owner = owner;
    this.threshold = threshold;
  }
}
