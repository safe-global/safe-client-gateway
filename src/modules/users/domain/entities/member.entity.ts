// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { SpaceSchema } from '@/modules/spaces/domain/entities/space.entity';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { NameSchema } from '@/domain/common/schemas/name.schema';

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
    alias: string | null;
    role: keyof typeof MemberRole;
    status: keyof typeof MemberStatus;
    invitedBy: number | null;
  }
> = RowSchema.extend({
  user: z.lazy(() => UserSchema),
  space: z.lazy(() => SpaceSchema),
  name: NameSchema,
  alias: NameSchema.nullable(),
  role: z.enum(getStringEnumKeys(MemberRole)),
  status: z.enum(getStringEnumKeys(MemberStatus)),
  invitedBy: z.number().int().nullable(),
});

export type Member = z.infer<typeof MemberSchema>;
