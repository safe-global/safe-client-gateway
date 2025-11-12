import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AppBalanceAppInfo {
  @ApiProperty({
    description: 'Application name',
  })
  public readonly name!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uri',
    description: 'Application logo URL (HTTPS)',
  })
  public readonly logoUrl?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uri',
    description: 'Application URL (HTTPS)',
  })
  public readonly url?: string;
}
