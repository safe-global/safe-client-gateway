import type { z } from 'zod';
import type {
  SafeSchema,
  SafeSchemaV2,
} from '@/modules/safe/domain/entities/schemas/safe.schema';

export type Safe = z.infer<typeof SafeSchema>;
export type SafeV2 = z.infer<typeof SafeSchemaV2>;
