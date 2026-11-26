// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import {
  SettingsChange,
  SettingsChangeType,
} from '#/modules/transactions/routes/entities/settings-changes/settings-change.entity';
import { AddressInfo } from '#/routes/common/entities/address-info.entity';

export class DeleteModuleGuard extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.DeleteModuleGuard] })
  declare type: SettingsChangeType.DeleteModuleGuard;

  @ApiProperty({
    type: AddressInfo,
    nullable: true,
    description:
      'The current module guard of the Safe while the transaction is queued, otherwise null',
  })
  moduleGuard: AddressInfo | null;

  constructor(moduleGuard: AddressInfo | null) {
    super(SettingsChangeType.DeleteModuleGuard);
    this.moduleGuard = moduleGuard;
  }
}
