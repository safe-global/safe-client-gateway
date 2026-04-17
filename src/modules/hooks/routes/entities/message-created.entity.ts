import type { z } from 'zod';
import type { MessageCreatedEventSchema } from '@/modules/hooks/routes/entities/schemas/message-created.schema';

export type MessageCreated = z.infer<typeof MessageCreatedEventSchema>;
