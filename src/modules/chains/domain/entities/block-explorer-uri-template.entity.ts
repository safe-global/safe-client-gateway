import type { z } from 'zod';
import type { BlockExplorerUriTemplateSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type BlockExplorerUriTemplate = z.infer<
  typeof BlockExplorerUriTemplateSchema
>;
