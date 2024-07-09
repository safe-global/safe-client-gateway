import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountDataSetting {
  @ApiProperty()
  name: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;
  @ApiProperty()
  enabled: boolean;

  constructor(name: string, description: string | null, enabled: boolean) {
    this.name = name;
    this.description = description;
    this.enabled = enabled;
  }
}
