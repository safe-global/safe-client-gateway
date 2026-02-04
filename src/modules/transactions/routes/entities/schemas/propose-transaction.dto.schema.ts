import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';
import {
  NullableAddressSchema,
  NullableHexSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';

export const ProposeTransactionDtoSchema = z.object({
  to: AddressSchema,
  value: NumericStringSchema,
  data: NullableHexSchema,
  nonce: NumericStringSchema,
  operation: z.enum(Operation),
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
