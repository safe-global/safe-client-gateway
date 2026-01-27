import type {
  SafeSchema,
  SafeSchemaV2,
} from '@/modules/safe/domain/entities/schemas/safe.schema';
import type { z } from 'zod';

export type Safe = z.infer<typeof SafeSchema>;
export type SafeV2 = z.infer<typeof SafeSchemaV2>;
