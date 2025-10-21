import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppPosition } from '@/routes/portfolio/entities/app-position.entity';

export class AppBalanceAppInfo {
  @ApiProperty({
    description: 'Application name',
    example: 'Aave V3',
  })
  name!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uri',
    description: 'Application logo URL (HTTPS)',
    example: 'https://example.com/aave-logo.png',
    nullable: true,
  })
  logoUrl!: string | null;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uri',
    description: 'Application URL (HTTPS)',
    example: 'https://aave.com',
    nullable: true,
  })
  url!: string | null;
}

export class AppBalance {
  @ApiProperty({
    description: 'Application information',
    type: AppBalanceAppInfo,
  })
  appInfo!: AppBalanceAppInfo;

  @ApiPropertyOptional({
    type: 'string',
    description: 'Total balance in fiat currency across all positions (decimal string)',
    example: '15000.00',
    nullable: true,
  })
  balanceFiat!: string | null;

  @ApiProperty({
    description: 'List of positions in this app',
    type: [AppPosition],
  })
  positions!: Array<AppPosition>;
}
