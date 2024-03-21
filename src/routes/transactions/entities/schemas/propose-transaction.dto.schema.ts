import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { Operation } from '@/domain/safe/entities/operation.entity';

export const ProposeTransactionDtoSchema = z.object({
  to: AddressSchema,
  value: NumericStringSchema,
  data: HexSchema.nullish().default(null),
  nonce: NumericStringSchema,
  operation: z.nativeEnum(Operation),
  safeTxGas: NumericStringSchema,
  baseGas: NumericStringSchema,
  gasPrice: NumericStringSchema,
  gasToken: AddressSchema,
  refundReceiver: AddressSchema.nullish().default(null),
  safeTxHash: HexSchema,
  sender: AddressSchema,
  signature: HexSchema.nullish().default(null),
  origin: z.string().nullish().default(null),
});
