// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import type { CounterfactualSafe as DbCounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import type { Address } from 'viem';

export type CounterfactualSafe = z.infer<typeof CounterfactualSafeSchema>;

export const CounterfactualSafeSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    chainId: DbCounterfactualSafe['chainId'];
    address: DbCounterfactualSafe['address'];
    factoryAddress: DbCounterfactualSafe['factoryAddress'];
    masterCopy: DbCounterfactualSafe['masterCopy'];
    saltNonce: DbCounterfactualSafe['saltNonce'];
    safeVersion: DbCounterfactualSafe['safeVersion'];
    threshold: DbCounterfactualSafe['threshold'];
    owners: DbCounterfactualSafe['owners'];
    fallbackHandler: DbCounterfactualSafe['fallbackHandler'];
    setupTo: DbCounterfactualSafe['setupTo'];
    setupData: DbCounterfactualSafe['setupData'];
    paymentToken: DbCounterfactualSafe['paymentToken'];
    payment: DbCounterfactualSafe['payment'];
    paymentReceiver: DbCounterfactualSafe['paymentReceiver'];
    creator?: DbCounterfactualSafe['creator'];
  }
> = RowSchema.extend({
  chainId: NumericStringSchema,
  address: AddressSchema as z.ZodType<Address>,
  factoryAddress: AddressSchema as z.ZodType<Address>,
  masterCopy: AddressSchema as z.ZodType<Address>,
  saltNonce: z.string(),
  safeVersion: z.string(),
  threshold: z.number().int().positive(),
  owners: z.array(AddressSchema as z.ZodType<Address>).nonempty(),
  fallbackHandler: (AddressSchema as z.ZodType<Address>).nullable(),
  setupTo: (AddressSchema as z.ZodType<Address>).nullable(),
  setupData: HexSchema,
  paymentToken: (AddressSchema as z.ZodType<Address>).nullable(),
  payment: z.string().nullable(),
  paymentReceiver: (AddressSchema as z.ZodType<Address>).nullable(),
  creator: z
    .lazy(() => UserSchema)
    .nullable()
    .optional(),
});
