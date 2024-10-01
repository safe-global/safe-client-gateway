import { RowSchema } from '@/datasources/db/entities/row.entity';
import type { z } from 'zod';

export type Group = z.infer<typeof GroupSchema>;

export const GroupSchema = RowSchema;
