// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export type Wallet = z.infer<typeof WalletSchema>;

export const WalletSchema = RowSchema.extend({
  // ZodEffects cannot be recursively inferred and need be casted
  address: AddressSchema as z.ZodType<Address>,
  user: UserSchema,
});
