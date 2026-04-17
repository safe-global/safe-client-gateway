import type { z } from 'zod';
import type { OutgoingEtherEventSchema } from '@/modules/hooks/routes/entities/schemas/outgoing-ether.schema';

export type OutgoingEther = z.infer<typeof OutgoingEtherEventSchema>;
