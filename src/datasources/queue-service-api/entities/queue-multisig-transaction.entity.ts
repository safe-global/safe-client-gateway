// SPDX-License-Identifier: FSL-1.1-MIT
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';
import {
  NullableAddressSchema,
  NullableHexSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';
import { z } from 'zod';

export type QueueConfirmation = z.infer<typeof QueueConfirmationSchema>;

export type QueueMultisigTransaction = z.infer<
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
  chainId: z.number(),
  safe: AddressSchema,
  nonce: z.number(),
  proposer: NullableAddressSchema,
  proposedByDelegate: NullableAddressSchema,
  to: AddressSchema,
  value: z.number(),
  data: NullableHexSchema,
  operation: z.number(),
  safeTxGas: z.number(),
  baseGas: z.number(),
  gasPrice: z.number(),
  gasToken: NullableAddressSchema,
  refundReceiver: NullableAddressSchema,
  failed: z.boolean().nullable().default(null),
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
