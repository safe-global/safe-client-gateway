import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { UserOrganizationSchema } from '@/domain/users/entities/user-organization.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';

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
  }
> = RowSchema.extend({
  name: z.string().max(255),
  status: z.enum(getStringEnumKeys(OrganizationStatus)),
  userOrganizations: z.array(z.lazy(() => UserOrganizationSchema)),
});
