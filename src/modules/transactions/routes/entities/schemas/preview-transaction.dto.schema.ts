import { z } from 'zod';
import { TransactionBaseSchema } from '@/domain/common/schemas/transaction-base.schema';
import { NullableHexSchema } from '@/validation/entities/schemas/nullable.schema';

export const PreviewTransactionDtoSchema = TransactionBaseSchema.extend({
  data: NullableHexSchema,
  value: z.string(),
});
