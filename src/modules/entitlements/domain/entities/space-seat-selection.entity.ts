// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';

export type SpaceSeatSelection = z.infer<typeof SpaceSeatSelectionSchema>;

export const SpaceSeatSelectionSchema = RowSchema.extend({});
