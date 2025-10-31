import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { AppPosition } from '@/routes/portfolio/entities/app-position.entity';

@ApiExtraModels(AppPosition)
export class AppPositionGroup {
  @ApiProperty({
    description: 'Group name (e.g., "Protocol A Vesting")',
  })
  name!: string;

  @ApiProperty({
    description: 'Positions in this group',
    type: 'array',
    items: { $ref: getSchemaPath(AppPosition) },
  })
  items!: Array<AppPosition>;
}
