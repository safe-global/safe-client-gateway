import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { UserOrganizationSchema } from '@/domain/users/entities/user-organization.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';

export enum OrganizationStatus {
  ACTIVE = 1,
}
export const OrganizationStatusKeys = Object.keys(OrganizationStatus) as [
  keyof typeof OrganizationStatus,
];

export type Organization = z.infer<typeof OrganizationSchema>;

// We need explicitly define ZodType due to recursion
export const OrganizationSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    name: string;
    status: (typeof OrganizationStatusKeys)[number];
    userOrganizations: Array<UserOrganization>;
  }
> = RowSchema.extend({
  name: z.string().max(255),
  status: z.enum(OrganizationStatusKeys),
  userOrganizations: z.array(z.lazy(() => UserOrganizationSchema)),
});
