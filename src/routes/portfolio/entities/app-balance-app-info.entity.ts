import { ApiProperty } from '@nestjs/swagger';

export class AppBalanceAppInfo {
  @ApiProperty({
    description: 'Application name',
  })
  name!: string;

  @ApiProperty({
    type: 'string',
    format: 'uri',
    description: 'Application logo URL (HTTPS)',
    nullable: true,
  })
  logoUrl: string | null = null;

  @ApiProperty({
    type: 'string',
    format: 'uri',
    description: 'Application URL (HTTPS)',
    nullable: true,
  })
  url: string | null = null;
}
