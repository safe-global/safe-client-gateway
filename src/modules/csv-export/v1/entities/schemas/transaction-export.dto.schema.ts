import { z } from 'zod';
import { DateStringSchema } from '@/validation/entities/schemas/date-string.schema';

export const TransactionExportDtoSchema = z
  .object({
    executionDateGte: DateStringSchema.optional(),
    executionDateLte: DateStringSchema.optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().min(0).optional(),
  })
  .optional();
