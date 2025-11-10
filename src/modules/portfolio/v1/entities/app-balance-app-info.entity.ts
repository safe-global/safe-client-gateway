import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AppBalanceAppInfo {
  @ApiProperty({
    description: 'Application name',
  })
  name!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uri',
    description: 'Application logo URL (HTTPS)',
  })
  logoUrl?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uri',
    description: 'Application URL (HTTPS)',
  })
  url?: string;
}
