// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';

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
