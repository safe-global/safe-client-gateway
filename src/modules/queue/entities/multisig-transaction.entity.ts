// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { CoercedNumberSchema } from '@/validation/entities/schemas/coerced-number.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';
import {
  NullableAddressSchema,
  NullableHexSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export type QueueConfirmation = z.infer<typeof QueueConfirmationSchema>;

export type QueueMultisigTransactionEntity = z.infer<
  typeof QueueMultisigTransactionSchema
>;

export const QueueConfirmationSchema = z.object({
  owner: AddressSchema,
  signature: HexBytesSchema,
  signatureType: z.enum(SignatureType),
  created: z.coerce.date(),
  modified: z.coerce.date(),
});

export const QueueMultisigTransactionSchema = z.object({
  safeTxHash: HexSchema,
  chainId: NumericStringSchema,
  safe: AddressSchema,
  nonce: CoercedNumberSchema,
  proposer: NullableAddressSchema,
  proposedByDelegate: NullableAddressSchema,
  to: AddressSchema,
  value: NumericStringSchema,
  data: NullableHexSchema,
  operation: z.enum(Operation),
  safeTxGas: NumericStringSchema.nullable(),
  baseGas: NumericStringSchema.nullable(),
  gasPrice: NumericStringSchema.nullable(),
  gasToken: NullableAddressSchema,
  refundReceiver: NullableAddressSchema,
  failed: z.boolean().nullable(),
  notes: NullableStringSchema,
  originName: NullableStringSchema,
  originUrl: NullableStringSchema,
  txHash: NullableHexSchema,
  created: z.coerce.date(),
  modified: z.coerce.date(),
  confirmations: z.array(QueueConfirmationSchema),
});

export const QueueMultisigTransactionPageSchema = buildPageSchema(
  QueueMultisigTransactionSchema,
);

export const QueueMultisigTransactionListSchema = z.array(
  QueueMultisigTransactionSchema,
);
