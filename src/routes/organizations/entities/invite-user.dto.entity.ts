import { z } from 'zod';
import { UserOrganizationRoleSchema } from '@/routes/organizations/entities/user-organization-role.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const InviteUserDtoSchema = z.object({
  walletAddress: AddressSchema,
  role: UserOrganizationRoleSchema,
});

export type InviteUserDto = z.infer<typeof InviteUserDtoSchema>;
