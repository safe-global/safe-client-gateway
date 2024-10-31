import type { MessageCreatedEventSchema } from '@/routes/hooks/entities/schemas/message-created.schema';
import type { z } from 'zod';

export type MessageCreated = z.infer<typeof MessageCreatedEventSchema>;
