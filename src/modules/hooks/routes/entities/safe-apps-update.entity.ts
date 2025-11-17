import type { SafeAppsUpdateEventSchema } from '@/modules/hooks/routes/entities/schemas/safe-apps-update.schema';
import type { z } from 'zod';

export type SafeAppsUpdate = z.infer<typeof SafeAppsUpdateEventSchema>;
