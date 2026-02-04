import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const NullableStringSchema = z.string().nullish().default(null);
export const NullableNumberSchema = z.number().nullish().default(null);
export const NullableCoercedDateSchema = z.coerce
  .date()
  .nullish()
  .default(null);
export const NullableAddressSchema = AddressSchema.nullish().default(null);
export const NullableHexSchema = HexSchema.nullish().default(null);
export const NullableNumericStringSchema =
  NumericStringSchema.nullish().default(null);
