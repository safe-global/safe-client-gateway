import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';
import {
  NullableAddressSchema,
  NullableHexSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';

export const CreationTransactionSchema = z.object({
  created: z.coerce.date(),
  creator: AddressSchema,
  transactionHash: HexSchema,
  factoryAddress: AddressSchema,
  masterCopy: NullableAddressSchema,
  setupData: NullableHexSchema,
  saltNonce: NullableStringSchema,
});
