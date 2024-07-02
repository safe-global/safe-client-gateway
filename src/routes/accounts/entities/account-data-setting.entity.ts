import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountDataSetting {
  @ApiProperty()
  accountDataSettingId: string;
  @ApiProperty()
  dataTypeName: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  dataTypeDescription: string | null;
  @ApiProperty()
  enabled: boolean;

  constructor(
    accountDataSettingId: string,
    dataTypeName: string,
    dataTypeDescription: string | null,
    enabled: boolean,
  ) {
    this.accountDataSettingId = accountDataSettingId;
    this.dataTypeName = dataTypeName;
    this.dataTypeDescription = dataTypeDescription;
    this.enabled = enabled;
  }
}
