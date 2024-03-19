import { OutgoingEtherEventSchema } from '@/routes/cache-hooks/entities/schemas/outgoing-ether.schema';
import { z } from 'zod';

export type OutgoingEther = z.infer<typeof OutgoingEtherEventSchema>;
