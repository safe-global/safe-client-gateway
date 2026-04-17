// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { OutreachSchema } from '@/modules/targeted-messaging/domain/entities/outreach.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export type TargetedSafe = z.infer<typeof TargetedSafeSchema>;

export const TargetedSafeSchema = RowSchema.extend({
  address: AddressSchema,
  outreachId: OutreachSchema.shape.id,
  chainId: z.string().nullable(),
});
