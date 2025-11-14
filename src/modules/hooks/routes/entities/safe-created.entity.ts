import type { SafeCreatedEventSchema } from '@/modules/hooks/routes/entities/schemas/safe-created.schema';
import type { z } from 'zod';

export type SafeCreated = z.infer<typeof SafeCreatedEventSchema>;
