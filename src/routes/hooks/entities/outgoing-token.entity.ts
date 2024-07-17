import { OutgoingTokenEventSchema } from '@/routes/hooks/entities/schemas/outgoing-token.schema';
import { z } from 'zod';

export type OutgoingToken = z.infer<typeof OutgoingTokenEventSchema>;
