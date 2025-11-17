import type { z } from 'zod';
import type { RpcUriSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type RpcUri = z.infer<typeof RpcUriSchema>;
