import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { OutreachSchema } from '@/domain/targeted-messaging/entities/outreach.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { z } from 'zod';

export type TargetedSafe = z.infer<typeof TargetedSafeSchema>;

export const TargetedSafeSchema = RowSchema.extend({
  address: AddressSchema,
  outreachId: OutreachSchema.shape.id,
});
