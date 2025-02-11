import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const UpdateOrganizationSchema = z.object({
  name: z.string().optional(),
  status: z.nativeEnum(OrganizationStatus).optional(),
});

export class UpdateOrganizationDto
  implements z.infer<typeof UpdateOrganizationSchema>
{
  @ApiPropertyOptional({ type: String })
  public readonly name?: Organization['name'];

  @ApiPropertyOptional({
    enum: OrganizationStatus,
  })
  public readonly status?: OrganizationStatus;
}

export class UpdateOrganizationResponse {
  @ApiProperty({ type: Number })
  public readonly id!: Organization['id'];
}
