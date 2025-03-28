import {
  SettingsChange,
  SettingsChangeType,
} from '@/routes/transactions/entities/settings-changes/settings-change.entity';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteGuard extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.DeleteGuard] })
  override type!: SettingsChangeType.DeleteGuard;

  constructor() {
    super(SettingsChangeType.DeleteGuard);
  }
}
