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
    type: 'string',
    description:
      'Total balance in fiat currency across all positions. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '18638914.125656575',
  })
  balanceFiat!: string;

  @ApiProperty({
    description: 'List of positions in this app',
    type: [AppPosition],
  })
  positions!: Array<AppPosition>;
}
