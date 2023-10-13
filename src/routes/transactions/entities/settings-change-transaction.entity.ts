import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { RichDecodedInfo } from '@/routes/transactions/entities/human-description.entity';
import { SettingsChange } from '@/routes/transactions/entities/settings-changes/settings-change.entity';
import { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';

export class SettingsChangeTransaction extends TransactionInfo {
  @ApiProperty()
  dataDecoded: DataDecoded;
  @ApiPropertyOptional()
  settingsInfo: SettingsChange | null;

  constructor(
    dataDecoded: DataDecoded,
    settingsInfo: SettingsChange | null,
    humanDescription: string | null,
    richDecodedInfo: RichDecodedInfo | null,
  ) {
    super('SettingsChange', humanDescription, richDecodedInfo);
    this.dataDecoded = dataDecoded;
    this.settingsInfo = settingsInfo;
  }
}
