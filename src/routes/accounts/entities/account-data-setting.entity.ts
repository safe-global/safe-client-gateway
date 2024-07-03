import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountDataSetting {
  @ApiProperty()
  dataTypeName: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  dataTypeDescription: string | null;
  @ApiProperty()
  enabled: boolean;

  constructor(
    dataTypeName: string,
    dataTypeDescription: string | null,
    enabled: boolean,
  ) {
    this.dataTypeName = dataTypeName;
    this.dataTypeDescription = dataTypeDescription;
    this.enabled = enabled;
  }
}
