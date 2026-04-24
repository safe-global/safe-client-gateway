// SPDX-License-Identifier: FSL-1.1-MIT
import { TransactionBaseSchema } from '@/domain/common/schemas/transaction-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import {
  NullableAddressSchema,
  NullableHexSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';

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
  origin: NullableStringSchema,
});
