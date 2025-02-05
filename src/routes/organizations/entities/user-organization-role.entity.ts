import { UserOrganizationRole } from '@/domain/users/entities/user-organization.entity';
import { z } from 'zod';

function isUserOrganizationRole(
  role: string,
): role is keyof typeof UserOrganizationRole {
  return role in UserOrganizationRole;
}

export const UserOrganizationRoleSchema = z
  .enum(['ADMIN', 'MEMBER'])
  .refine(isUserOrganizationRole)
  .transform((role) => {
    return UserOrganizationRole[role];
  });
