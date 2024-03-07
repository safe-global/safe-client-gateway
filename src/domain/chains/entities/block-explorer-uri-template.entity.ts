import { z } from 'zod';
import { BlockExplorerUriTemplateSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type BlockExplorerUriTemplate = z.infer<
  typeof BlockExplorerUriTemplateSchema
>;
