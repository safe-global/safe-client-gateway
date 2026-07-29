// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';

export type SpaceFeatureUsage = z.infer<typeof SpaceFeatureUsageSchema>;

export const SpaceFeatureUsageSchema = RowSchema.extend({
  periodStart: z.date(),
  used: z.number().int(),
});
