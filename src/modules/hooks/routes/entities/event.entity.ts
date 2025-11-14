import type { EventSchema } from '@/modules/hooks/routes/entities/schemas/event.schema';
import type { z } from 'zod';

export type Event = z.infer<typeof EventSchema>;
