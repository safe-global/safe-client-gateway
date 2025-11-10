import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { AppPositionGroup } from '@/modules/portfolio/v1/entities/app-position-group.entity';
import { AppBalanceAppInfo } from './app-balance-app-info.entity';

@ApiExtraModels(AppPositionGroup)
export class AppBalance {
  @ApiProperty({
    description: 'Application information',
    type: AppBalanceAppInfo,
  })
  appInfo!: AppBalanceAppInfo;

  @ApiProperty({
    type: 'string',
    description:
      'Total balance in fiat currency across all position groups. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '18638914.125656575',
  })
  balanceFiat!: string;

  @ApiProperty({
    description: 'Position groups in this app, grouped by position name',
    type: 'array',
    items: { $ref: getSchemaPath(AppPositionGroup) },
  })
  groups!: Array<AppPositionGroup>;
}
