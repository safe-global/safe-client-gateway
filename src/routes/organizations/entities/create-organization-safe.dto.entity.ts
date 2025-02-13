import { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { ChainSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ApiProperty } from '@nestjs/swagger';

import { z } from 'zod';

export const CreateOrganizationSafeSchema = z.object({
  chainId: ChainSchema.shape.chainId.max(78),
  address: AddressSchema,
});

export const CreateOrganizationSafesSchema = z
  .array(CreateOrganizationSafeSchema)
  .nonempty();

export class CreateOrganizationSafeDto
  implements z.infer<typeof CreateOrganizationSafeSchema>
{
  @ApiProperty({ type: String })
  public readonly chainId!: OrganizationSafe['chainId'];

  @ApiProperty({ type: String })
  public readonly address!: OrganizationSafe['address'];
}
