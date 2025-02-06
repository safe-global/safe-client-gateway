import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty()
  name!: Organization['name'];
}
