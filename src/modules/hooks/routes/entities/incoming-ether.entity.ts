import type { IncomingEtherEventSchema } from '@/modules/hooks/routes/entities/schemas/incoming-ether.schema';
import type { z } from 'zod';

export type IncomingEther = z.infer<typeof IncomingEtherEventSchema>;
