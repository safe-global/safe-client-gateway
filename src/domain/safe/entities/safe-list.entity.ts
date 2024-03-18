import { SafeListSchema } from '@/domain/safe/entities/schemas/safe-list.schema';
import { z } from 'zod';

export type SafeList = z.infer<typeof SafeListSchema>;
