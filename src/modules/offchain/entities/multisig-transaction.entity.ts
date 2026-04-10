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
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export type OffchainConfirmation = z.infer<typeof OffchainConfirmationSchema>;

export type OffchainMultisigTransactionEntity = z.infer<
  typeof OffchainMultisigTransactionSchema
>;

export const OffchainConfirmationSchema = z.object({
  owner: AddressSchema,
  signature: HexBytesSchema,
  signatureType: z.enum(SignatureType),
  created: z.coerce.date(),
  modified: z.coerce.date(),
});

export const OffchainMultisigTransactionSchema = z.object({
  safeTxHash: HexSchema,
  chainId: z.number(),
  safe: AddressSchema,
  nonce: z.number(),
  proposer: NullableAddressSchema,
  proposedByDelegate: NullableAddressSchema,
  to: AddressSchema,
  value: z.number(),
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
  confirmations: z.array(OffchainConfirmationSchema),
});

export const OffchainMultisigTransactionPageSchema = buildPageSchema(
  OffchainMultisigTransactionSchema,
);
