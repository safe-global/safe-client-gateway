import { WebHookSchema } from '@/routes/cache-hooks/entities/schemas/web-hook.schema';
import { z } from 'zod';

export type Event = z.infer<typeof WebHookSchema>;
