import type { z } from 'zod';
import type { EventSchema } from '@/modules/hooks/routes/entities/schemas/event.schema';

export type Event = z.infer<typeof EventSchema>;
