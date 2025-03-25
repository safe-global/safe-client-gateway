import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/routes/transactions/entities/settings-changes/settings-change.entity';

export class RemoveOwner extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.RemoveOwner] })
  override type!: SettingsChangeType.RemoveOwner;

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
