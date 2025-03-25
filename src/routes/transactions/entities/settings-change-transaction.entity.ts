import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { SettingsChange } from '@/routes/transactions/entities/settings-changes/settings-change.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { AddOwner } from '@/routes/transactions/entities/settings-changes/add-owner.entity';
import { ChangeMasterCopy } from '@/routes/transactions/entities/settings-changes/change-master-copy.entity';
import { ChangeThreshold } from '@/routes/transactions/entities/settings-changes/change-threshold.entity';
import { DeleteGuard } from '@/routes/transactions/entities/settings-changes/delete-guard';
import { DisableModule } from '@/routes/transactions/entities/settings-changes/disable-module.entity';
import { EnableModule } from '@/routes/transactions/entities/settings-changes/enable-module.entity';
import { RemoveOwner } from '@/routes/transactions/entities/settings-changes/remove-owner.entity';
import { SetFallbackHandler } from '@/routes/transactions/entities/settings-changes/set-fallback-handler.entity';
import { SetGuard } from '@/routes/transactions/entities/settings-changes/set-guard.entity';
import { SwapOwner } from '@/routes/transactions/entities/settings-changes/swap-owner.entity';

@ApiExtraModels(
  AddOwner,
  ChangeMasterCopy,
  ChangeThreshold,
  DeleteGuard,
  DisableModule,
  EnableModule,
  RemoveOwner,
  SetFallbackHandler,
  SetGuard,
  SettingsChange,
  SwapOwner,
)
export class SettingsChangeTransaction extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.SettingsChange] })
  override type = TransactionInfoType.SettingsChange;
  @ApiProperty()
  dataDecoded: DataDecoded;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(AddOwner) },
      { $ref: getSchemaPath(ChangeMasterCopy) },
      { $ref: getSchemaPath(ChangeThreshold) },
      { $ref: getSchemaPath(DeleteGuard) },
      { $ref: getSchemaPath(DisableModule) },
      { $ref: getSchemaPath(EnableModule) },
      { $ref: getSchemaPath(RemoveOwner) },
      { $ref: getSchemaPath(SetFallbackHandler) },
      { $ref: getSchemaPath(SetGuard) },
      { $ref: getSchemaPath(SwapOwner) },
    ],
  })
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
