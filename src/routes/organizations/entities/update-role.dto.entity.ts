import { z } from 'zod';
import { UserOrganizationRoleKeys } from '@/domain/users/entities/user-organization.entity';

export const UpdateRoleDtoSchema = z.object({
  role: z.enum(UserOrganizationRoleKeys),
});

export type UpdateRoleDto = z.infer<typeof UpdateRoleDtoSchema>;
