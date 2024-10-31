import type { IncomingTokenEventSchema } from '@/routes/hooks/entities/schemas/incoming-token.schema';
import type { z } from 'zod';

export type IncomingToken = z.infer<typeof IncomingTokenEventSchema>;
