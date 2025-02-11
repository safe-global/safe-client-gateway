import { z } from 'zod';
import { UserOrganizationRole } from '@/domain/users/entities/user-organization.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { getStringEnumKeys } from '@/domain/common/utils/enum';

const MAX_INVITE_USERS = 50;

export const InviteUsersDtoSchema = z
  .array(
    z.object({
      address: AddressSchema,
      role: z.enum(getStringEnumKeys(UserOrganizationRole)),
    }),
  )
  .min(1)
  .max(MAX_INVITE_USERS);

export type InviteUsersDto = z.infer<typeof InviteUsersDtoSchema>;
