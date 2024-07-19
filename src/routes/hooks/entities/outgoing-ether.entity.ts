import { OutgoingEtherEventSchema } from '@/routes/hooks/entities/schemas/outgoing-ether.schema';
import { z } from 'zod';

export type OutgoingEther = z.infer<typeof OutgoingEtherEventSchema>;
