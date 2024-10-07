import type { SafeCreatedEventSchema } from '@/routes/hooks/entities/schemas/safe-created.schema';
import type { z } from 'zod';

export type SafeCreated = z.infer<typeof SafeCreatedEventSchema>;
