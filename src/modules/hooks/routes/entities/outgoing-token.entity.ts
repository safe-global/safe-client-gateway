import type { OutgoingTokenEventSchema } from '@/modules/hooks/routes/entities/schemas/outgoing-token.schema';
import type { z } from 'zod';

export type OutgoingToken = z.infer<typeof OutgoingTokenEventSchema>;
