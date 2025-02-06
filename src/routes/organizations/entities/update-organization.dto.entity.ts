import { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  public name?: string;

  @ApiPropertyOptional()
  public status?: OrganizationStatus;
}

export class UpdateOrganizationResponse {
  @ApiProperty()
  public id!: number;
}
