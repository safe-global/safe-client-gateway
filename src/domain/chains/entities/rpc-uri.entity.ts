import type { z } from 'zod';
import type { RpcUriSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type RpcUri = z.infer<typeof RpcUriSchema>;
