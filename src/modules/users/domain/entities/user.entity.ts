// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { WalletSchema } from '@/modules/wallets/domain/entities/wallet.entity';
import { MemberSchema } from '@/modules/users/domain/entities/member.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Wallet } from '@/modules/wallets/domain/entities/wallet.entity';
import type { Member } from '@/modules/users/domain/entities/member.entity';

export enum UserStatus {
  PENDING = 0,
  ACTIVE = 1,
}

export type User = z.infer<typeof UserSchema>;

// We need explicitly define ZodType due to recursion
export const UserSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    status: keyof typeof UserStatus;
    extUserId: string | null;
    wallets: Array<Wallet>;
    members: Array<Member>;
  }
> = RowSchema.extend({
  status: z.enum(getStringEnumKeys(UserStatus)),
  extUserId: z.string().min(1).max(255).nullable(),
  wallets: z.array(WalletSchema),
  members: z.array(z.lazy(() => MemberSchema)),
});
