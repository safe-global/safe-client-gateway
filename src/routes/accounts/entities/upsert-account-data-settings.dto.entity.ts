import { UpsertAccountDataSettingsDto as DomainUpsertAccountDataSettingsDto } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';
import { ApiProperty } from '@nestjs/swagger';

// TODO: schema tests

class UpsertAccountDataSettingDto {
  @ApiProperty()
  dataTypeName!: string;
  @ApiProperty()
  enabled!: boolean;
}

export class UpsertAccountDataSettingsDto
  implements DomainUpsertAccountDataSettingsDto
{
  @ApiProperty({ type: UpsertAccountDataSettingDto, isArray: true })
  accountDataSettings!: UpsertAccountDataSettingDto[];
}
