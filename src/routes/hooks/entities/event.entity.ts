import type { EventSchema } from '@/routes/hooks/entities/schemas/event.schema';
import type { z } from 'zod';

export type Event = z.infer<typeof EventSchema>;
