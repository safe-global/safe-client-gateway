import { IncomingTokenEventSchema } from '@/routes/hooks/entities/schemas/incoming-token.schema';
import { z } from 'zod';

export type IncomingToken = z.infer<typeof IncomingTokenEventSchema>;
