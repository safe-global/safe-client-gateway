// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { BeaconChainExplorerUriTemplateSchema } from '#/modules/chains/domain/entities/schemas/chain.schema';

export type BeaconChainExplorerUriTemplate = z.infer<
  typeof BeaconChainExplorerUriTemplateSchema
>;
