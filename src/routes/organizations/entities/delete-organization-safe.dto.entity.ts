import { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { ChainIdSchema } from '@/domain/chains/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

const DeleteOrganizationSafeSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

export const DeleteOrganizationSafesSchema = z.object({
  safes: z.array(DeleteOrganizationSafeSchema).nonempty(),
});

export class DeleteOrganizationSafeDto
  implements z.infer<typeof DeleteOrganizationSafeSchema>
{
  @ApiProperty({ type: String })
  public readonly chainId!: OrganizationSafe['chainId'];

  @ApiProperty({ type: String })
  public readonly address!: OrganizationSafe['address'];
}

export class DeleteOrganizationSafesDto
  implements z.infer<typeof DeleteOrganizationSafesSchema>
{
  @ApiProperty({ type: DeleteOrganizationSafeDto, isArray: true })
  public readonly safes!: [
    DeleteOrganizationSafeDto,
    ...Array<DeleteOrganizationSafeDto>,
  ];
}
