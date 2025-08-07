import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Position } from '@/routes/positions/entities/position.entity';

@ApiExtraModels(Position)
export class Positions {
  @ApiProperty()
  fiatTotal!: string;
  @ApiProperty({ type: 'array', oneOf: [{ $ref: getSchemaPath(Position) }] })
  items!: Array<Position>;
}
