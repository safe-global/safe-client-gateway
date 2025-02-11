import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { OrganizationSchema } from '@/domain/organizations/entities/organization.entity';
import { UserSchema } from '@/domain/users/entities/user.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';

export enum UserOrganizationRole {
  ADMIN = 1,
  MEMBER = 2,
}
export const UserOrganizationRoleKeys = Object.keys(UserOrganizationRole) as [
  keyof typeof UserOrganizationRole,
];

export enum UserOrganizationStatus {
  INVITED = 0,
  ACTIVE = 1,
  DECLINED = 2,
}
const UserOrganizationStatusKeys = Object.keys(UserOrganizationStatus) as [
  keyof typeof UserOrganizationStatus,
];

// We need explicitly define ZodType due to recursion
export const UserOrganizationSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    user: User;
    organization: Organization;
    name: string | null;
    role: (typeof UserOrganizationRoleKeys)[number];
    status: (typeof UserOrganizationStatusKeys)[number];
  }
> = RowSchema.extend({
  user: z.lazy(() => UserSchema),
  organization: z.lazy(() => OrganizationSchema),
  name: z.string().nullable(),
  role: z.enum(UserOrganizationRoleKeys),
  status: z.enum(UserOrganizationStatusKeys),
});

export type UserOrganization = z.infer<typeof UserOrganizationSchema>;
