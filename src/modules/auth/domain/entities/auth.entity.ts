// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';

export enum AuthType {
  GOOGLE = 1,
}

export const AuthSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    type: keyof typeof AuthType;
    extUserId: string;
    user: User;
  }
> = RowSchema.extend({
  type: z.enum(getStringEnumKeys(AuthType)),
  extUserId: z.string().min(1).max(255),
  user: z.lazy(() => UserSchema),
});

export type Auth = z.infer<typeof AuthSchema>;
