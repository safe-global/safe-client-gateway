import { OutgoingTokenEventSchema } from '@/routes/cache-hooks/entities/schemas/outgoing-token.schema';
import { z } from 'zod';

export type OutgoingToken = z.infer<typeof OutgoingTokenEventSchema>;
