import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { z } from 'zod';
import {
  NullableCoercedDateSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';

export type Outreach = z.infer<typeof OutreachSchema>;

export const OutreachSchema = RowSchema.extend({
  name: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  sourceId: z
    .number()
    .int()
    .gte(1)
    .lte(DB_MAX_SAFE_INTEGER - 1),
  type: z.string(),
  teamName: z.string(),
  sourceFile: NullableStringSchema,
  sourceFileProcessedDate: NullableCoercedDateSchema,
  sourceFileChecksum: NullableStringSchema,
  targetAll: z.boolean(),
});
