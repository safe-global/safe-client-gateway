import type { z } from 'zod';
import type { SafeAppsUpdateEventSchema } from '@/modules/hooks/routes/entities/schemas/safe-apps-update.schema';

export type SafeAppsUpdate = z.infer<typeof SafeAppsUpdateEventSchema>;
