import { z } from 'zod';
import { UserOrganizationRole } from '@/domain/users/entities/user-organization.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';

export const UpdateRoleDtoSchema = z.object({
  role: z.enum(getStringEnumKeys(UserOrganizationRole)),
});

export type UpdateRoleDto = z.infer<typeof UpdateRoleDtoSchema>;
