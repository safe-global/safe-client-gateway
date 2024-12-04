import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { SettingsChange } from '@/routes/transactions/entities/settings-changes/settings-change.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';

export class SettingsChangeTransaction extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.SettingsChange] })
  override type = TransactionInfoType.SettingsChange;
  @ApiProperty()
  dataDecoded: DataDecoded;
  @ApiPropertyOptional({ type: SettingsChange, nullable: true })
  settingsInfo: SettingsChange | null;

  constructor(
    dataDecoded: DataDecoded,
    settingsInfo: SettingsChange | null,
    humanDescription: string | null,
  ) {
    super(TransactionInfoType.SettingsChange, humanDescription);
    this.dataDecoded = dataDecoded;
    this.settingsInfo = settingsInfo;
  }
}
