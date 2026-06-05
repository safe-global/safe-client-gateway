// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import {
  makeNameSchema,
  NameSchema,
} from '@/domain/common/schemas/name.schema';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceSchema } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
export enum MemberRole {
  ADMIN = 1,
  MEMBER = 2,
}

export enum MemberStatus {
  INVITED = 0,
  ACTIVE = 1,
  DECLINED = 2,
}

export const MEMBER_NAME_MAX_LENGTH = 255;

export type Member = z.infer<typeof RowSchema> & {
  user: User;
  space: Space;
  name: string;
  alias: string | null;
  role: keyof typeof MemberRole;
  status: keyof typeof MemberStatus;
  invitedBy: number | null;
  inviteExpiresAt: Date | null;
};

// The lazy callbacks are explicitly typed to break the circular inference
// with UserSchema/SpaceSchema, while keeping MemberSchema a ZodObject (exposing `.shape`).
export const MemberSchema = RowSchema.extend({
  user: z.lazy((): z.ZodType<User> => UserSchema),
  space: z.lazy((): z.ZodType<Space> => SpaceSchema),
  name: makeNameSchema({ maxLength: MEMBER_NAME_MAX_LENGTH }),
  alias: NameSchema.nullable(),
  role: z.enum(getStringEnumKeys(MemberRole)),
  status: z.enum(getStringEnumKeys(MemberStatus)),
  invitedBy: z.number().int().positive().nullable(),
  inviteExpiresAt: z.date().nullable(),
});
