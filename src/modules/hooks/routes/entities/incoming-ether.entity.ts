import type { z } from 'zod';
import type { IncomingEtherEventSchema } from '@/modules/hooks/routes/entities/schemas/incoming-ether.schema';

export type IncomingEther = z.infer<typeof IncomingEtherEventSchema>;
