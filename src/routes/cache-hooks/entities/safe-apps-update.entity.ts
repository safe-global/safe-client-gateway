import { SafeAppsUpdateEventSchema } from '@/routes/cache-hooks/entities/schemas/safe-apps-update.schema';
import { z } from 'zod';

export type SafeAppsUpdate = z.infer<typeof SafeAppsUpdateEventSchema>;
