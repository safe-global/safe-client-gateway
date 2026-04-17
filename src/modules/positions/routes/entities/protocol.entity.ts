// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { PositionGroup } from '@/modules/positions/routes/entities/position-group.entity';
import type { ProtocolMetadata } from '@/modules/positions/routes/entities/protocol-metadata.entity';

@ApiExtraModels(PositionGroup)
export class Protocol {
  @ApiProperty()
  protocol!: string;
  @ApiProperty()
  protocol_metadata!: ProtocolMetadata;
  @ApiProperty()
  fiatTotal!: string;
  @ApiProperty({
    type: 'array',
    oneOf: [{ $ref: getSchemaPath(PositionGroup) }],
  })
  items!: Array<PositionGroup>;
}
