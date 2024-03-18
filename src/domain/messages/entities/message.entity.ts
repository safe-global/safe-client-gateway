import { MessageSchema } from '@/domain/messages/entities/schemas/message.schema';
import { z } from 'zod';

export type Message = z.infer<typeof MessageSchema>;
