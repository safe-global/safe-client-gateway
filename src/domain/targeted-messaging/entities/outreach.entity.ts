import { RowSchema } from '@/datasources/db/entities/row.entity';
import { z } from 'zod';

export type Outreach = z.infer<typeof OutreachSchema>;

export const OutreachSchema = RowSchema.extend({
  name: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});
