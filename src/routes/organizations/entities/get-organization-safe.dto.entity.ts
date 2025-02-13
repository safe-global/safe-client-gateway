import type { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { ApiProperty } from '@nestjs/swagger';

export class GetOrganizationSafes {
  [chainId: OrganizationSafe['chainId']]: Array<OrganizationSafe['address']>;
}

export class GetOrganizationSafeResponse {
  @ApiProperty({
    type: GetOrganizationSafes,
    isArray: true,
  })
  public readonly safes!: GetOrganizationSafes;
}
