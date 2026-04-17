import type { z } from 'zod';
import type { SafeCreatedEventSchema } from '@/modules/hooks/routes/entities/schemas/safe-created.schema';

export type SafeCreated = z.infer<typeof SafeCreatedEventSchema>;
