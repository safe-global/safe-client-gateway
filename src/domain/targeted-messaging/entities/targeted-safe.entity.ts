import { RowSchema } from '@/datasources/db/entities/row.entity';
import { OutreachSchema } from '@/domain/targeted-messaging/entities/outreach.entity';
import { z } from 'zod';

export type TargetedSafe = z.infer<typeof TargetedSafeSchema>;

export const TargetedSafeSchema = RowSchema.extend({
  address: z.string(),
  outreachId: OutreachSchema.shape.id,
});
