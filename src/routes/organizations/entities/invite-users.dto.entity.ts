import { z } from 'zod';
import { UserOrganizationRoleKeys } from '@/domain/users/entities/user-organization.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const InviteUsersDtoSchema = z
  .array(
    z.object({
      address: AddressSchema,
      role: z.enum(UserOrganizationRoleKeys),
    }),
  )
  .min(1);

export type InviteUsersDto = z.infer<typeof InviteUsersDtoSchema>;
