import type { z } from 'zod';
import type { BeaconChainExplorerUriTemplateSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type BeaconChainExplorerUriTemplate = z.infer<
  typeof BeaconChainExplorerUriTemplateSchema
>;
