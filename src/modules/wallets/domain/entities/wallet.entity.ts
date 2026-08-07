// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export type Wallet = z.infer<typeof WalletSchema>;

export const WalletSchema = RowSchema.extend({
  // A wallet address is a raw string at rest: KMS ciphertext (`kms:v1:`) when
  // field encryption is enabled, EIP-55 plaintext otherwise. It is decrypted
  // to a checksummed address at the repository boundary, so the inferred type
  // is a plain string; the AddressSchema runtime validation is retained.
  address: AddressSchema as z.ZodType<string>,
  user: UserSchema,
});
