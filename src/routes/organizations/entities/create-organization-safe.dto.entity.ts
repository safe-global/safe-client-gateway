import { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { ChainIdSchema } from '@/domain/chains/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ApiProperty } from '@nestjs/swagger';

import { z } from 'zod';

const CreateOrganizationSafeSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

export const CreateOrganizationSafesSchema = z.object({
  safes: z.array(CreateOrganizationSafeSchema).nonempty(),
});

export class CreateOrganizationSafeDto
  implements z.infer<typeof CreateOrganizationSafeSchema>
{
  @ApiProperty({ type: String })
  public readonly chainId!: OrganizationSafe['chainId'];

  @ApiProperty({ type: String })
  public readonly address!: OrganizationSafe['address'];
}

export class CreateOrganizationSafesDto
  implements z.infer<typeof CreateOrganizationSafesSchema>
{
  @ApiProperty({ type: CreateOrganizationSafeDto, isArray: true })
  public readonly safes!: [
    CreateOrganizationSafeDto,
    ...Array<CreateOrganizationSafeDto>,
  ];
}
