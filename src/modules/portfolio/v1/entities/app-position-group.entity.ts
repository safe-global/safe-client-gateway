import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { AppPosition } from '@/modules/portfolio/v1/entities/app-position.entity';

@ApiExtraModels(AppPosition)
export class AppPositionGroup {
  @ApiProperty({
    description: 'Group name (e.g., "Protocol A Vesting")',
  })
  public readonly name!: string;

  @ApiProperty({
    description: 'Positions in this group',
    type: 'array',
    items: { $ref: getSchemaPath(AppPosition) },
  })
  public readonly items!: Array<AppPosition>;
}
