import type { OutgoingTokenEventSchema } from '@/routes/hooks/entities/schemas/outgoing-token.schema';
import type { z } from 'zod';

export type OutgoingToken = z.infer<typeof OutgoingTokenEventSchema>;
