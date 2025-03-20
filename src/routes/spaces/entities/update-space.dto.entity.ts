import { Organization as Space } from '@/datasources/organizations/entities/organizations.entity.db';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { OrganizationStatus as SpaceStatus } from '@/domain/organizations/entities/organization.entity';
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
