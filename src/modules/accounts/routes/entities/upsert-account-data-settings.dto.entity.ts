import { UpsertAccountDataSettingsDto as DomainUpsertAccountDataSettingsDto } from '@/modules/accounts/domain/entities/upsert-account-data-settings.dto.entity';
import { ApiProperty } from '@nestjs/swagger';

class UpsertAccountDataSettingDto {
  @ApiProperty()
  dataTypeId!: string; // A 'numeric string' type is used to align with other API endpoints
  @ApiProperty()
  enabled!: boolean;
}

export class UpsertAccountDataSettingsDto implements DomainUpsertAccountDataSettingsDto {
  @ApiProperty({ type: UpsertAccountDataSettingDto, isArray: true })
  accountDataSettings!: Array<UpsertAccountDataSettingDto>;
}
