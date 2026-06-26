// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { TransactionBaseSchema } from '@/domain/common/schemas/transaction-base.schema';
import { Origin } from '@/modules/fees/domain/entities/origin.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const FeePreviewTransactionDtoSchema = TransactionBaseSchema.extend({
  gasToken: AddressSchema,
  numberSignatures: z.number().int().min(1),
  nonce: NumericStringSchema,
  origin: z.enum(Origin).optional(),
  fiatCode: z.string().optional(),
});
