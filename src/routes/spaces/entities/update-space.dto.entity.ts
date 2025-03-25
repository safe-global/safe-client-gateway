import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { SpaceStatus } from '@/domain/spaces/entities/space.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const UpdateSpaceSchema = z.object({
  name: z.string().optional(),
  status: z.enum(getStringEnumKeys(SpaceStatus)).optional(),
});

export class UpdateSpaceDto implements z.infer<typeof UpdateSpaceSchema> {
  @ApiPropertyOptional({ type: String })
  public readonly name?: Space['name'];

  @ApiPropertyOptional({
    enum: getStringEnumKeys(SpaceStatus),
  })
  public readonly status?: keyof typeof SpaceStatus;
}

export class UpdateSpaceResponse {
  @ApiProperty({ type: Number })
  public readonly id!: Space['id'];
}
