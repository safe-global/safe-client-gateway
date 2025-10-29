import { ApiProperty } from '@nestjs/swagger';
import { AppPosition } from '@/routes/portfolio/entities/app-position.entity';

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

export class AppBalance {
  @ApiProperty({
    description: 'Application information',
    type: AppBalanceAppInfo,
  })
  appInfo!: AppBalanceAppInfo;

  @ApiProperty({
    type: 'number',
    description: 'Total balance in fiat currency across all positions',
  })
  balanceFiat!: number;

  @ApiProperty({
    description: 'List of positions in this app',
    type: [AppPosition],
  })
  positions!: Array<AppPosition>;
}
