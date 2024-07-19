import { EventSchema } from '@/routes/hooks/entities/schemas/event.schema';
import { z } from 'zod';

export type Event = z.infer<typeof EventSchema>;
