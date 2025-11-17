import type { IncomingTokenEventSchema } from '@/modules/hooks/routes/entities/schemas/incoming-token.schema';
import type { z } from 'zod';

export type IncomingToken = z.infer<typeof IncomingTokenEventSchema>;
