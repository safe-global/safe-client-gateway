import { z } from 'zod';
import { UserOrganizationRole } from '@/domain/users/entities/user-organization.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { getStringEnumKeys } from '@/domain/common/utils/enum';

export const InviteUsersDtoSchema = z
  .array(
    z.object({
      address: AddressSchema,
      role: z.enum(getStringEnumKeys(UserOrganizationRole)),
    }),
  )
  .min(1);

export type InviteUsersDto = z.infer<typeof InviteUsersDtoSchema>;
