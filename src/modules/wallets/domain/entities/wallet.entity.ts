// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type { Address } from 'viem';

export type Wallet = z.infer<typeof WalletSchema>;

// We need to explicitly define ZodType due to recursion
export const WalletSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    address: Address;
    user: User;
  }
> = RowSchema.extend({
  // ZodEffects cannot be recursively inferred and need be casted
  address: AddressSchema as z.ZodType<Address>,
  user: z.lazy(() => UserSchema),
});
