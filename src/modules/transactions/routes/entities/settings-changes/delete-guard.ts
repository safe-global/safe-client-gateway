import {
  SettingsChange,
  SettingsChangeType,
} from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteGuard extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.DeleteGuard] })
  declare type: SettingsChangeType.DeleteGuard;

  constructor() {
    super(SettingsChangeType.DeleteGuard);
  }
}
