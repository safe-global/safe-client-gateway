import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
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
