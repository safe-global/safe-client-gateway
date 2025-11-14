import type { SafeAppSchema } from '@/modules/safe-apps/domain/entities/schemas/safe-app.schema';
import type { z } from 'zod';

export type SafeApp = z.infer<typeof SafeAppSchema>;
