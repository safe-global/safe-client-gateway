import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { SettingsChange } from '@/modules/transactions/routes/entities/settings-changes/settings-change.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/modules/transactions/routes/entities/transaction-info.entity';
import { AddOwner } from '@/modules/transactions/routes/entities/settings-changes/add-owner.entity';
import { ChangeMasterCopy } from '@/modules/transactions/routes/entities/settings-changes/change-master-copy.entity';
import { ChangeThreshold } from '@/modules/transactions/routes/entities/settings-changes/change-threshold.entity';
import { DeleteGuard } from '@/modules/transactions/routes/entities/settings-changes/delete-guard';
import { DisableModule } from '@/modules/transactions/routes/entities/settings-changes/disable-module.entity';
import { EnableModule } from '@/modules/transactions/routes/entities/settings-changes/enable-module.entity';
import { RemoveOwner } from '@/modules/transactions/routes/entities/settings-changes/remove-owner.entity';
import { SetFallbackHandler } from '@/modules/transactions/routes/entities/settings-changes/set-fallback-handler.entity';
import { SetGuard } from '@/modules/transactions/routes/entities/settings-changes/set-guard.entity';
import { SwapOwner } from '@/modules/transactions/routes/entities/settings-changes/swap-owner.entity';

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
