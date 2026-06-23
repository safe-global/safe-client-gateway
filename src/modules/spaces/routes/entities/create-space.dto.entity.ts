// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { SpaceSchema } from '@/modules/spaces/domain/entities/space.entity';

export const CreateSpaceSchema = z.object({
  name: SpaceSchema.shape.name,
});

export class CreateSpaceDto implements z.infer<typeof CreateSpaceSchema> {
  @ApiProperty({ type: String })
  public readonly name!: Space['name'];
}

export class CreateSpaceResponse {
  @ApiProperty({ type: String })
  public readonly name!: Space['name'];

  @ApiProperty({ type: String, description: 'Space UUID' })
  public readonly uuid!: Space['uuid'];
}
