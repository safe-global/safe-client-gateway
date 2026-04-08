// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateSpaceSchema = z.object({
  name: z.string(),
});

export class CreateSpaceDto implements z.infer<typeof CreateSpaceSchema> {
  @ApiProperty({ type: String })
  public readonly name!: Space['name'];
}

export class CreateSpaceResponse {
  @ApiProperty({ type: String })
  public readonly name!: Space['name'];

  @ApiProperty({ type: Number })
  public readonly id!: Space['id'];
}
