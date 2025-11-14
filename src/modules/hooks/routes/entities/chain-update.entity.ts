import type { ChainUpdateEventSchema } from '@/modules/hooks/routes/entities/schemas/chain-update.schema';
import type { z } from 'zod';

export type ChainUpdate = z.infer<typeof ChainUpdateEventSchema>;
