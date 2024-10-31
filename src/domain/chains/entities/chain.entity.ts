import type { z } from 'zod';
import type { ChainSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type Chain = z.infer<typeof ChainSchema>;
