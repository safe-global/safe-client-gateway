import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { SpaceSchema } from '@/domain/spaces/entities/space.entity';
import { UserSchema } from '@/domain/users/entities/user.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Space } from '@/domain/spaces/entities/space.entity';
import type { User } from '@/domain/users/entities/user.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NameSchema } from '@/domain/common/entities/name.schema';

export enum MemberRole {
  ADMIN = 1,
  MEMBER = 2,
}

export enum MemberStatus {
  INVITED = 0,
  ACTIVE = 1,
  DECLINED = 2,
}

// We need explicitly define ZodType due to recursion
export const MemberSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    user: User;
    space: Space;
    name: string;
    role: keyof typeof MemberRole;
    status: keyof typeof MemberStatus;
    invitedBy: `0x${string}` | null;
  }
> = RowSchema.extend({
  user: z.lazy(() => UserSchema),
  space: z.lazy(() => SpaceSchema),
  name: NameSchema,
  role: z.enum(getStringEnumKeys(MemberRole)),
  status: z.enum(getStringEnumKeys(MemberStatus)),
  invitedBy: AddressSchema.nullable() as z.ZodType<`0x${string}` | null>,
});

export type Member = z.infer<typeof MemberSchema>;
