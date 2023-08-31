import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecoded } from '../../data-decode/entities/data-decoded.entity';
import { SettingsChange } from './settings-changes/settings-change.entity';
import { TransactionInfo } from './transaction-info.entity';
import { RichHumanDescriptionFragment } from '@/routes/transactions/entities/human-description.entity';

export class SettingsChangeTransaction extends TransactionInfo {
  @ApiProperty()
  dataDecoded: DataDecoded;
  @ApiPropertyOptional()
  settingsInfo: SettingsChange | null;

  constructor(
    dataDecoded: DataDecoded,
    settingsInfo: SettingsChange | null,
    humanDescription: RichHumanDescriptionFragment[] | null,
  ) {
    super('SettingsChange', humanDescription);
    this.dataDecoded = dataDecoded;
    this.settingsInfo = settingsInfo;
  }
}
