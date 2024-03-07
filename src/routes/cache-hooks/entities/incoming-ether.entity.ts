import { IncomingEtherEventSchema } from '@/routes/cache-hooks/entities/schemas/incoming-ether.schema';
import { z } from 'zod';

export type IncomingEther = z.infer<typeof IncomingEtherEventSchema>;
