import { ApiProperty } from '@nestjs/swagger';

export class AccountDataSetting {
  @ApiProperty()
  dataTypeId: string;
  @ApiProperty()
  enabled: boolean;

  constructor(dataTypeId: string, enabled: boolean) {
    this.dataTypeId = dataTypeId;
    this.enabled = enabled;
  }
}
