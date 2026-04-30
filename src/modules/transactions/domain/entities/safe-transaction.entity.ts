// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

// Zod does not support bigint natively, so we use string and transform
const BigIntSchema = z.string().transform((val, ctx) => {
  try {
    return BigInt(val);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid bigint string' });
    return z.NEVER;
  }
});

export const SafeTransactionSchema = z.object({
  to: AddressSchema,
  value: BigIntSchema,
  data: HexSchema,
  operation: z.number().int(),
  safeTxGas: BigIntSchema,
  baseGas: BigIntSchema,
  gasPrice: BigIntSchema,
  gasToken: AddressSchema,
  refundReceiver: AddressSchema,
});

export type SafeTransaction = z.infer<typeof SafeTransactionSchema>;

export type SafeTransactionWithSignature = SafeTransaction & {
  signatures: z.infer<typeof HexSchema>;
};
