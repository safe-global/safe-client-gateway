import type { SafeListSchema } from '@/domain/safe/entities/schemas/safe-list.schema';
import type { z } from 'zod';

export type SafeList = z.infer<typeof SafeListSchema>;
