import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { WalletSchema } from '@/domain/wallets/entities/wallet.entity';
import { UserOrganizationSchema } from '@/domain/users/entities/user-organization.entity';
import type { Wallet } from '@/domain/wallets/entities/wallet.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';

export enum UserStatus {
  ACTIVE = 1,
}

export type User = z.infer<typeof UserSchema>;

// We need explicitly define ZodType due to recursion
export const UserSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    status: UserStatus;
    wallets: Array<Wallet>;
    user_organizations: Array<UserOrganization>;
  }
> = RowSchema.extend({
  status: z.nativeEnum(UserStatus),
  wallets: z.array(WalletSchema),
  user_organizations: z.array(z.lazy(() => UserOrganizationSchema)),
});
