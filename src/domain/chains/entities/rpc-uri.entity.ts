import { z } from 'zod';
import { RpcUriSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type RpcUri = z.infer<typeof RpcUriSchema>;
