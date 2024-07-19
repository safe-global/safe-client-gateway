import { ChainUpdateEventSchema } from '@/routes/hooks/entities/schemas/chain-update.schema';
import { z } from 'zod';

export type ChainUpdate = z.infer<typeof ChainUpdateEventSchema>;
