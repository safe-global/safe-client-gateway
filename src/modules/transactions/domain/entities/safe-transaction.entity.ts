// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { BigIntSchema } from '@/validation/entities/schemas/bigint.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const SafeTransactionSchema = z.object({
  to: AddressSchema,
  value: BigIntSchema,
  data: HexSchema,
  operation: z.enum(Operation),
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
