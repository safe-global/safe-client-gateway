import type { MessageCreatedEventSchema } from '@/modules/hooks/routes/entities/schemas/message-created.schema';
import type { z } from 'zod';

export type MessageCreated = z.infer<typeof MessageCreatedEventSchema>;
