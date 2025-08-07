import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { PositionGroup } from '@/routes/positions/entities/position-group.entity';

export class Protocols {
  @ApiProperty()
  protocol!: string;
  @ApiProperty()
  fiatTotal!: string;
  @ApiProperty({
    type: 'array',
    oneOf: [{ $ref: getSchemaPath(PositionGroup) }],
  })
  items!: Array<PositionGroup>;
}
