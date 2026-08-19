// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { TransactionBaseSchema } from '@/domain/common/schemas/transaction-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import {
  NullableAddressSchema,
  NullableHexSchema,
} from '@/validation/entities/schemas/nullable.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';

export const MAX_ORIGIN_DTO_LENGTH = 2048;

export const ProposeTransactionDtoSchema = TransactionBaseSchema.extend({
  data: NullableHexSchema,
  nonce: NumericStringSchema,
  safeTxGas: NumericStringSchema,
  baseGas: NumericStringSchema,
  gasPrice: NumericStringSchema,
  gasToken: AddressSchema,
  refundReceiver: NullableAddressSchema,
  safeTxHash: HexSchema,
  sender: AddressSchema,
  signature: SignatureSchema.nullish().default(null),
  origin: z.string().max(MAX_ORIGIN_DTO_LENGTH).nullish().default(null),
});
