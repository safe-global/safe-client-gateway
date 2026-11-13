// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { getStringEnumKeys } from '#/domain/common/utils/enum';
import type { Space } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import {
  type ExperimentalFeature,
  ExperimentalFeatures,
} from '#/modules/spaces/domain/entities/experimental-feature.entity';
import {
  SpaceSchema,
  SpaceStatus,
} from '#/modules/spaces/domain/entities/space.entity';

export const UpdateSpaceSchema = z.object({
  name: SpaceSchema.shape.name.optional(),
  status: z.enum(getStringEnumKeys(SpaceStatus)).optional(),
  experimentalFeatures: SpaceSchema.shape.experimentalFeatures.optional(),
});

export class UpdateSpaceDto implements z.infer<typeof UpdateSpaceSchema> {
  @ApiPropertyOptional({ type: String })
  public readonly name?: Space['name'];

  @ApiPropertyOptional({
    enum: getStringEnumKeys(SpaceStatus),
  })
  public readonly status?: keyof typeof SpaceStatus;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    enum: ExperimentalFeatures,
    description:
      'Replaces the stored set; [] opts out of all. Omit to leave it unchanged.',
  })
  public readonly experimentalFeatures?: Array<ExperimentalFeature>;
}

export class UpdateSpaceResponse {
  @ApiProperty({ type: String, description: 'Space UUID' })
  public readonly uuid!: Space['uuid'];
}
