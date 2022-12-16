import { ApiProperty } from '@nestjs/swagger';
import { SettingsChange } from './settings-change.entity';

export class ChangeThreshold extends SettingsChange {
  @ApiProperty()
  threshold: number;

  constructor(threshold: number) {
    super('CHANGE_THRESHOLD');
    this.threshold = threshold;
  }
}
