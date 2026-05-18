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
  NullableNumericStringSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';

const SpaceQueueConfirmationSchema = z.object({
  owner: AddressSchema,
  signature: HexBytesSchema.nullish().default(null),
  signatureType: z.enum(SignatureType),
  created: z.coerce.date(),
});

export const SpaceQueueTransactionSchema = z.object({
  chainId: z.coerce.string(),
  safe: AddressSchema,
  safeTxHash: HexSchema,
  nonce: CoercedNumberSchema,
  to: AddressSchema,
  value: z.coerce.string(),
  data: NullableHexSchema,
  operation: z.enum(Operation),
  safeTxGas: CoercedNumberSchema.nullish().default(null),
  baseGas: CoercedNumberSchema.nullish().default(null),
  gasPrice: NullableNumericStringSchema,
  gasToken: NullableAddressSchema,
  refundReceiver: NullableAddressSchema,
  proposer: NullableAddressSchema,
  proposedByDelegate: NullableAddressSchema,
  failed: z.boolean().nullish().default(null),
  notes: NullableStringSchema,
  originName: NullableStringSchema,
  originUrl: NullableStringSchema,
  txHash: NullableHexSchema,
  created: z.coerce.date(),
  modified: z.coerce.date().nullish().default(null),
  confirmations: z.array(SpaceQueueConfirmationSchema).nullish().default([]),
});

export type SpaceQueueTransaction = z.infer<typeof SpaceQueueTransactionSchema>;

export const SpaceQueueTransactionPageSchema = buildPageSchema(
  SpaceQueueTransactionSchema,
);
