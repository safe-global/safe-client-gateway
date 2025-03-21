import type { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { ApiProperty } from '@nestjs/swagger';

export class GetOrganizationSafeResponse {
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    example: {
      '{chainId}': ['0x...'],
    },
  })
  public readonly safes!: {
    [chainId: OrganizationSafe['chainId']]: Array<OrganizationSafe['address']>;
  };
}
