import { MessageCreatedEventSchema } from '@/routes/cache-hooks/entities/schemas/message-created.schema';
import { z } from 'zod';

export type MessageCreated = z.infer<typeof MessageCreatedEventSchema>;
