import type { z } from 'zod';
import type { ChainSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type Chain = z.infer<typeof ChainSchema>;
