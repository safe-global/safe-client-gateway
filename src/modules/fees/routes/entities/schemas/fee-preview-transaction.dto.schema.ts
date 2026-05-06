// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { TransactionBaseSchema } from '@/domain/common/schemas/transaction-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const FeePreviewTransactionDtoSchema = TransactionBaseSchema.extend({
  gasToken: AddressSchema,
  numberSignatures: z.number().int().min(1),
});
