import { SiweMessageSchema } from '@/domain/auth/entities/schemas/siwe-message.schema';
import { z } from 'zod';

export type SiweMessage = z.infer<typeof SiweMessageSchema>;
