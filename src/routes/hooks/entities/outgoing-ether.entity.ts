import type { OutgoingEtherEventSchema } from '@/routes/hooks/entities/schemas/outgoing-ether.schema';
import type { z } from 'zod';

export type OutgoingEther = z.infer<typeof OutgoingEtherEventSchema>;
