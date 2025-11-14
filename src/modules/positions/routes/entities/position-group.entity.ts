import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Position } from '@/modules/positions/routes/entities/position.entity';

@ApiExtraModels(Position)
export class PositionGroup {
  @ApiProperty()
  name!: string;
  @ApiProperty({ type: 'array', oneOf: [{ $ref: getSchemaPath(Position) }] })
  items!: Array<Position>;
}
