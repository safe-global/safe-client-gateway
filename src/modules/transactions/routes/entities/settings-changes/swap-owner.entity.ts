import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';

export class SwapOwner extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.SwapOwner] })
  declare type: SettingsChangeType.SwapOwner;

  @ApiProperty()
  oldOwner: AddressInfo;
  @ApiProperty()
  newOwner: AddressInfo;

  constructor(oldOwner: AddressInfo, newOwner: AddressInfo) {
    super(SettingsChangeType.SwapOwner);
    this.oldOwner = oldOwner;
    this.newOwner = newOwner;
  }
}
