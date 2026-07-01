// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { Origin } from '@/modules/fees/domain/entities/origin.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NonNegativeNumericStringSchema } from '@/validation/entities/schemas/non-negative-numeric-string.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const GtfFeesRequestSchema = z.object({
  to: AddressSchema,
  value: NumericStringSchema,
  data: HexSchema,
  operation: z.enum(Operation),
  numberSignatures: z.number().int().min(1),
  nonce: NonNegativeNumericStringSchema,
  gasToken: AddressSchema,
  origin: z.enum(Origin).optional(),
});
