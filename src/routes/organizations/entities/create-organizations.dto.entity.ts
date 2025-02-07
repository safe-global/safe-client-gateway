import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { ApiProperty } from '@nestjs/swagger';
import { number } from 'zod';

export class CreateOrganizationResponse {
  @ApiProperty({ type: String })
  public readonly name!: Organization['name'];

  @ApiProperty({ type: number })
  public readonly id!: Organization['id'];
}
