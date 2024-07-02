import { RowSchema } from '@/datasources/db/entities/row.entity';
import { z } from 'zod';

export type AccountDataType = z.infer<typeof AccountDataTypeSchema>;

export const AccountDataTypeSchema = RowSchema.extend({
  name: z.string(),
  description: z.string().nullish().default(null),
  is_active: z.boolean().default(true),
});
