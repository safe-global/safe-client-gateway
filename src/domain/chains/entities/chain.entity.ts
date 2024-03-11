import { z } from 'zod';
import { ChainSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type Chain = z.infer<typeof ChainSchema>;
