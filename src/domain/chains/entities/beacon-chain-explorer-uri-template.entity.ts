import { z } from 'zod';
import { BeaconChainExplorerUriTemplateSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type BeaconChainExplorerUriTemplate = z.infer<
  typeof BeaconChainExplorerUriTemplateSchema
>;
