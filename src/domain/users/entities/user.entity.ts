import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { WalletSchema } from '@/domain/wallets/entities/wallet.entity';
import { MemberSchema } from '@/domain/users/entities/member.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Wallet } from '@/domain/wallets/entities/wallet.entity';
import type { Member } from '@/domain/users/entities/member.entity';

export enum UserStatus {
  PENDING = 0,
  ACTIVE = 1,
}

export type User = z.infer<typeof UserSchema>;

// We need explicitly define ZodType due to recursion
export const UserSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    status: keyof typeof UserStatus;
    wallets: Array<Wallet>;
    members: Array<Member>;
  }
> = RowSchema.extend({
  status: z.enum(getStringEnumKeys(UserStatus)),
  wallets: z.array(WalletSchema),
  members: z.array(z.lazy(() => MemberSchema)),
});
