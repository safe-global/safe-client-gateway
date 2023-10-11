import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { SettingsChange } from '@/routes/transactions/entities/settings-changes/settings-change.entity';

export class AddOwner extends SettingsChange {
  @ApiProperty()
  owner: AddressInfo;
  @ApiProperty()
  threshold: number;

  constructor(owner: AddressInfo, threshold: number) {
    super('ADD_OWNER');
    this.owner = owner;
    this.threshold = threshold;
  }
}
