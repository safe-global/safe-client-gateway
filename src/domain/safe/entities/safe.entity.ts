import { SafeSchema } from '@/domain/safe/entities/schemas/safe.schema';
import { z } from 'zod';

export type Safe = z.infer<typeof SafeSchema>;
