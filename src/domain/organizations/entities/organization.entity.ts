import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { UserOrganizationSchema } from '@/domain/users/entities/user-organization.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';
import { OrganizationSafeSchema } from '@/domain/organizations/entities/organization-safe.entity';
import type { Organization as DbOrganization } from '@/datasources/organizations/entities/organizations.entity.db';

export enum OrganizationStatus {
  ACTIVE = 1,
}

export type Organization = z.infer<typeof OrganizationSchema>;

// We need explicitly define ZodType due to recursion
export const OrganizationSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    name: string;
    status: keyof typeof OrganizationStatus;
    userOrganizations: Array<UserOrganization>;
    safes?: DbOrganization['safes'];
  }
> = RowSchema.extend({
  name: z.string().max(255),
  status: z.enum(getStringEnumKeys(OrganizationStatus)),
  userOrganizations: z.array(z.lazy(() => UserOrganizationSchema)),
  safes: z.array(z.lazy(() => OrganizationSafeSchema)).optional(),
});
