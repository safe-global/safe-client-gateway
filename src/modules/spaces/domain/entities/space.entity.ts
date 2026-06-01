// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { NameSchema } from '@/domain/common/schemas/name.schema';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Space as DbSpace } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { SpaceSafe } from '@/modules/spaces/domain/entities/space-safe.entity';
import { SpaceSafeSchema } from '@/modules/spaces/domain/entities/space-safe.entity';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import { MemberSchema } from '@/modules/users/domain/entities/member.entity';

export enum SpaceStatus {
  ACTIVE = 1,
}

export type Space = z.infer<typeof RowSchema> & {
  name: string;
  status: keyof typeof SpaceStatus;
  members: Array<Member>;
  safes?: DbSpace['safes'];
};

// The lazy callbacks are explicitly typed to break the circular inference
// with MemberSchema, while keeping SpaceSchema a ZodObject (exposing `.shape`).
export const SpaceSchema = RowSchema.extend({
  uuid: z.string().uuid(),
  name: NameSchema,
  status: z.enum(getStringEnumKeys(SpaceStatus)),
  members: z.array(z.lazy((): z.ZodType<Member> => MemberSchema)),
  safes: z
    .array(z.lazy((): z.ZodType<SpaceSafe> => SpaceSafeSchema))
    .optional(),
});
