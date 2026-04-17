import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { NameSchema } from '@/domain/common/schemas/name.schema';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Space as DbSpace } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceSafeSchema } from '@/modules/spaces/domain/entities/space-safe.entity';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import { MemberSchema } from '@/modules/users/domain/entities/member.entity';

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
