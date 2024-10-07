import type { SafeAppsUpdateEventSchema } from '@/routes/hooks/entities/schemas/safe-apps-update.schema';
import type { z } from 'zod';

export type SafeAppsUpdate = z.infer<typeof SafeAppsUpdateEventSchema>;
