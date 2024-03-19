import { IncomingTokenEventSchema } from '@/routes/cache-hooks/entities/schemas/incoming-token.schema';
import { z } from 'zod';

export type IncomingToken = z.infer<typeof IncomingTokenEventSchema>;
