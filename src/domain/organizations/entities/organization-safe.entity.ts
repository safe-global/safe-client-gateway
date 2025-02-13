import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import type { OrganizationSafe as DbOrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { ChainSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { OrganizationSchema } from '@/domain/organizations/entities/organization.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export enum OrganizationStatus {
  ACTIVE = 1,
}

export type OrganizationSafe = z.infer<typeof OrganizationSafeSchema>;

// We need explicitly define ZodType due to recursion
export const OrganizationSafeSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    chainId: DbOrganizationSafe['chainId'];
    address: DbOrganizationSafe['address'];
    organization?: DbOrganizationSafe['organization'];
  }
> = RowSchema.extend({
  chainId: ChainSchema.shape.chainId,
  address: AddressSchema as z.ZodType<`0x${string}`>,
  organization: z.lazy(() => OrganizationSchema).optional(),
});
