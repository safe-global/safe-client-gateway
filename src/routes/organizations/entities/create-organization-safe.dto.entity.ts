import { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ApiProperty } from '@nestjs/swagger';

import { z } from 'zod';

export const CreateOrganizationSafeSchema = z.object({
  chainId: NumericStringSchema.refine(
    (val) => val.length <= CHAIN_ID_MAXLENGTH,
    {
      message: `Value must be less than or euqal to ${CHAIN_ID_MAXLENGTH}`,
    },
  ),
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
