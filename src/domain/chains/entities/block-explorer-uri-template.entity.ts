import type { z } from 'zod';
import type { BlockExplorerUriTemplateSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type BlockExplorerUriTemplate = z.infer<
  typeof BlockExplorerUriTemplateSchema
>;
