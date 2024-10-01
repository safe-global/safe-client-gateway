import type { SafeAppSchema } from '@/domain/safe-apps/entities/schemas/safe-app.schema';
import type { z } from 'zod';

export type SafeApp = z.infer<typeof SafeAppSchema>;
