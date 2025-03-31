import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { MemberSchema } from '@/domain/users/entities/member.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Member } from '@/domain/users/entities/member.entity';
import { SpaceSafeSchema } from '@/domain/spaces/entities/space-safe.entity';
import type { Space as DbSpace } from '@/datasources/spaces/entities/space.entity.db';
import { NameSchema } from '@/domain/common/entities/name.schema';

export enum SpaceStatus {
  ACTIVE = 1,
}

export type Space = z.infer<typeof SpaceSchema>;

// We need explicitly define ZodType due to recursion
export const SpaceSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    name: string;
    status: keyof typeof SpaceStatus;
    members: Array<Member>;
    safes?: DbSpace['safes'];
  }
> = RowSchema.extend({
  name: NameSchema,
  status: z.enum(getStringEnumKeys(SpaceStatus)),
  members: z.array(z.lazy(() => MemberSchema)),
  safes: z.array(z.lazy(() => SpaceSafeSchema)).optional(),
});
