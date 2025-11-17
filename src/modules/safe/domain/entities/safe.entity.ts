import type { SafeSchema } from '@/modules/safe/domain/entities/schemas/safe.schema';
import type { z } from 'zod';

export type Safe = z.infer<typeof SafeSchema>;
