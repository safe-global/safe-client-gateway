import type { OutgoingEtherEventSchema } from '@/modules/hooks/routes/entities/schemas/outgoing-ether.schema';
import type { z } from 'zod';

export type OutgoingEther = z.infer<typeof OutgoingEtherEventSchema>;
