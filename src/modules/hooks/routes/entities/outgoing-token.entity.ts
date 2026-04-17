import type { z } from 'zod';
import type { OutgoingTokenEventSchema } from '@/modules/hooks/routes/entities/schemas/outgoing-token.schema';

export type OutgoingToken = z.infer<typeof OutgoingTokenEventSchema>;
