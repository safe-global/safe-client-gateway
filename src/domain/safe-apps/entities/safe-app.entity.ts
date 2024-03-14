import { SafeAppSchema } from '@/domain/safe-apps/entities/schemas/safe-app.schema';
import { z } from 'zod';

export type SafeApp = z.infer<typeof SafeAppSchema>;
