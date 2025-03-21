import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { OrganizationSchema } from '@/domain/organizations/entities/organization.entity';
import { UserSchema } from '@/domain/users/entities/user.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export enum UserOrganizationRole {
  ADMIN = 1,
  MEMBER = 2,
}

export enum UserOrganizationStatus {
  INVITED = 0,
  ACTIVE = 1,
  DECLINED = 2,
}

// We need explicitly define ZodType due to recursion
export const UserOrganizationSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    user: User;
    organization: Organization;
    name: string;
    role: keyof typeof UserOrganizationRole;
    status: keyof typeof UserOrganizationStatus;
    invitedBy: `0x${string}` | null;
  }
> = RowSchema.extend({
  user: z.lazy(() => UserSchema),
  organization: z.lazy(() => OrganizationSchema),
  name: z.string(),
  role: z.enum(getStringEnumKeys(UserOrganizationRole)),
  status: z.enum(getStringEnumKeys(UserOrganizationStatus)),
  invitedBy: AddressSchema.nullable() as z.ZodType<`0x${string}` | null>,
});

export type UserOrganization = z.infer<typeof UserOrganizationSchema>;
