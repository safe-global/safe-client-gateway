import type { IncomingEtherEventSchema } from '@/routes/hooks/entities/schemas/incoming-ether.schema';
import type { z } from 'zod';

export type IncomingEther = z.infer<typeof IncomingEtherEventSchema>;
