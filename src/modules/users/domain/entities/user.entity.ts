// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import { MemberSchema } from '@/modules/users/domain/entities/member.entity';
import type { Wallet } from '@/modules/wallets/domain/entities/wallet.entity';
import { WalletSchema } from '@/modules/wallets/domain/entities/wallet.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { EmailAddress } from '@/validation/entities/schemas/email-address.schema';
import { EmailAddressSchema } from '@/validation/entities/schemas/email-address.schema';

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
    email: EmailAddress | null;
    // Derived on read paths that resolve a user's wallet (currently the
    // members roster): the decrypted address of the user's lowest-`id`
    // wallet. Optional deliberately — no `users` column backs it, and the
    // DB entity's `implements DomainUser` clause must stay satisfiable
    // without it.
    address?: string | null;
    wallets: Array<Wallet>;
    members: Array<Member>;
  }
> = RowSchema.extend({
  status: z.enum(getStringEnumKeys(UserStatus)),
  extUserId: z.string().min(1).max(255).nullable(),
  email: EmailAddressSchema.nullable(),
  // Decrypted to a checksummed address before it is attached, so the
  // inferred type is a plain string; the AddressSchema runtime validation
  // is retained (same idiom as WalletSchema.address).
  address: (AddressSchema as z.ZodType<string>).nullable().optional(),
  wallets: z.array(WalletSchema),
  members: z.array(z.lazy(() => MemberSchema)),
});
