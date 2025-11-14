import type { SafeListSchema } from '@/modules/safe/domain/entities/schemas/safe-list.schema';
import type { z } from 'zod';

export type SafeList = z.infer<typeof SafeListSchema>;
