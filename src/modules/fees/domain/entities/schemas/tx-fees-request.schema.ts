// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const TxFeesRequestSchema = z.object({
  to: AddressSchema,
  value: NumericStringSchema,
  data: HexSchema,
  operation: z.enum(Operation),
  numberSignatures: z.number().int().min(1),
  gasToken: AddressSchema,
});
