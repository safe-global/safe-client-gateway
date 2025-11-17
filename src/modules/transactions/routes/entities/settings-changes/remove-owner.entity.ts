import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';

export class RemoveOwner extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.RemoveOwner] })
  declare type: SettingsChangeType.RemoveOwner;

  @ApiProperty()
  owner: AddressInfo;
  @ApiProperty()
  threshold: number;

  constructor(owner: AddressInfo, threshold: number) {
    super(SettingsChangeType.RemoveOwner);
    this.owner = owner;
    this.threshold = threshold;
  }
}
