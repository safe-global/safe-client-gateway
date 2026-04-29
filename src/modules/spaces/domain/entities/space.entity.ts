// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { MemberSchema } from '@/modules/users/domain/entities/member.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import { SpaceSafeSchema } from '@/modules/spaces/domain/entities/space-safe.entity';
import type { Space as DbSpace } from '@/modules/spaces/datasources/entities/space.entity.db';
import { NameSchema } from '@/domain/common/schemas/name.schema';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import type { UUID } from 'crypto';

export enum SpaceStatus {
  ACTIVE = 1,
}

export type Space = z.infer<typeof SpaceSchema>;

// We need explicitly define ZodType due to recursion
export const SpaceSchema: z.ZodType<
  Omit<z.infer<typeof RowSchema>, 'id'> & {
    id: UUID;
    name: string;
    status: keyof typeof SpaceStatus;
    members: Array<Member>;
    safes?: DbSpace['safes'];
  }
> = RowSchema.extend({
  // Spaces use UUID PKs instead of RowSchema's sequential int
  id: UuidSchema,
  name: NameSchema,
  status: z.enum(getStringEnumKeys(SpaceStatus)),
  members: z.array(z.lazy(() => MemberSchema)),
  safes: z.array(z.lazy(() => SpaceSafeSchema)).optional(),
});
