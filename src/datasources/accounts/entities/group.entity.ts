import { RowSchema } from '@/datasources/db/entities/row.entity';
import { z } from 'zod';

export type Group = z.infer<typeof GroupSchema>;

export const GroupSchema = RowSchema
