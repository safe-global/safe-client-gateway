import type { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import type { Address } from 'viem';

export type Wallet = z.infer<typeof WalletSchema>;

export const WalletSchema = RowSchema.extend({
  // ZodEffects cannot be recursively inferred and need be casted
  address: AddressSchema as z.ZodType<Address>,
  user: UserSchema,
});
