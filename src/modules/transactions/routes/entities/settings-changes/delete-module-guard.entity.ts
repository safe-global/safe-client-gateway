// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';

export class DeleteModuleGuard extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.DeleteModuleGuard] })
  declare type: SettingsChangeType.DeleteModuleGuard;

  constructor() {
    super(SettingsChangeType.DeleteModuleGuard);
  }
}
