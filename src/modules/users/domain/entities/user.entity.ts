// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import { z } from 'zod';
import { RowSchema } from '#/datasources/db/v2/entities/row.entity';
import { getStringEnumKeys } from '#/domain/common/utils/enum';
import type { Member } from '#/modules/users/domain/entities/member.entity';
import { MemberSchema } from '#/modules/users/domain/entities/member.entity';
import type { Wallet } from '#/modules/wallets/domain/entities/wallet.entity';
import { WalletSchema } from '#/modules/wallets/domain/entities/wallet.entity';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import type { EmailAddress } from '#/validation/entities/schemas/email-address.schema';
import { EmailAddressSchema } from '#/validation/entities/schemas/email-address.schema';

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
    // Derived at read time — no `users` column backs it. Optional so the
    // DB entity's `implements DomainUser` stays satisfiable without it.
    // Unlike `Wallet.address`, this never holds KMS ciphertext: it is
    // attached post-decryption, so the checksummed `Address` type applies.
    address?: Address | null;
    wallets: Array<Wallet>;
    members: Array<Member>;
  }
> = RowSchema.extend({
  status: z.enum(getStringEnumKeys(UserStatus)),
  extUserId: z.string().min(1).max(255).nullable(),
  email: EmailAddressSchema.nullable(),
  address: AddressSchema.nullable().optional(),
  wallets: z.array(WalletSchema),
  members: z.array(z.lazy(() => MemberSchema)),
});
