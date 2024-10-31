import type { ChainUpdateEventSchema } from '@/routes/hooks/entities/schemas/chain-update.schema';
import type { z } from 'zod';

export type ChainUpdate = z.infer<typeof ChainUpdateEventSchema>;
