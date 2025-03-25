import { ApiProperty } from '@nestjs/swagger';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/routes/transactions/entities/settings-changes/settings-change.entity';

export class ChangeThreshold extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.ChangeThreshold] })
  override type!: SettingsChangeType.ChangeThreshold;

  @ApiProperty()
  threshold: number;

  constructor(threshold: number) {
    super(SettingsChangeType.ChangeThreshold);
    this.threshold = threshold;
  }
}
