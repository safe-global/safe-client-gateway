import { z } from 'zod';
import { UserOrganizationRoleSchema } from '@/routes/organizations/entities/user-organization-role.entity';

export const UpdateRoleDtoSchema = z.object({
  role: UserOrganizationRoleSchema,
});

export type UpdateRoleDto = z.infer<typeof UpdateRoleDtoSchema>;
