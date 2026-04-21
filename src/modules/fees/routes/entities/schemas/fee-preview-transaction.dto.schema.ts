// SPDX-License-Identifier: FSL-1.1-MIT
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { TransactionBaseSchema } from '@/domain/common/schemas/transaction-base.schema';
import { z } from 'zod';

export const FeePreviewTransactionDtoSchema = TransactionBaseSchema.extend({
  gasToken: AddressSchema,
  numberSignatures: z.number().int().min(1),
});
