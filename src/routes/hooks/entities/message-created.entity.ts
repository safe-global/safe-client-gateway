import { MessageCreatedEventSchema } from '@/routes/hooks/entities/schemas/message-created.schema';
import { z } from 'zod';

export type MessageCreated = z.infer<typeof MessageCreatedEventSchema>;
