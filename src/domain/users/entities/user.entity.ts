import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { WalletSchema } from '@/domain/wallets/entities/wallet.entity';
import { UserOrganizationSchema } from '@/domain/users/entities/user-organization.entity';
import type { Wallet } from '@/domain/wallets/entities/wallet.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';

export enum UserStatus {
  PENDING = 0,
  ACTIVE = 1,
}
export const UserStatusKeys = Object.keys(UserStatus) as [
  keyof typeof UserStatus,
];

export type User = z.infer<typeof UserSchema>;

// We need explicitly define ZodType due to recursion
export const UserSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    status: (typeof UserStatusKeys)[number];
    wallets: Array<Wallet>;
    userOrganizations: Array<UserOrganization>;
  }
> = RowSchema.extend({
  status: z.enum(UserStatusKeys),
  wallets: z.array(WalletSchema),
  userOrganizations: z.array(z.lazy(() => UserOrganizationSchema)),
});
