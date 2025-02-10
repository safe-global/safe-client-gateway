import { z } from 'zod';
import { UserOrganizationRoleSchema } from '@/routes/organizations/entities/user-organization-role.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const InviteUsersDtoSchema = z
  .array(
    z.object({
      address: AddressSchema,
      role: UserOrganizationRoleSchema,
    }),
  )
  .min(1);

export type InviteUsersDto = z.infer<typeof InviteUsersDtoSchema>;
