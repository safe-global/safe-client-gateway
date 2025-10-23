import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppPosition } from '@/routes/portfolio/entities/app-position.entity';

export class AppBalanceAppInfo {
  @ApiProperty({
    description: 'Application name',
  })
  name!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uri',
    description: 'Application logo URL (HTTPS)',
    nullable: true,
  })
  logoUrl!: string | null;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uri',
    description: 'Application URL (HTTPS)',
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
    type: 'number',
    description: 'Total balance in fiat currency across all positions',
    example: 15000.00,
    nullable: true,
  })
  balanceFiat!: number | null;

  @ApiProperty({
    description: 'List of positions in this app',
    type: [AppPosition],
  })
  positions!: Array<AppPosition>;
}
