import { ApiProperty } from '@nestjs/swagger';
import { DataDecoded } from '../../data-decode/entities/data-decoded.entity';
import { SettingsChange } from './settings-changes/settings-change.entity';
import { TransactionInfo } from './transaction-info.entity';

export class SettingsChangeTransaction extends TransactionInfo {
  @ApiProperty()
  dataDecoded: DataDecoded;
  @ApiProperty()
  settingsInfo: SettingsChange;

  constructor(dataDecoded: DataDecoded, settingsInfo: SettingsChange) {
    super('SettingsChange');
    this.dataDecoded = dataDecoded;
    this.settingsInfo = settingsInfo;
  }
}
