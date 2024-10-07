import type { SafeSchema } from '@/domain/safe/entities/schemas/safe.schema';
import type { z } from 'zod';

export type Safe = z.infer<typeof SafeSchema>;
