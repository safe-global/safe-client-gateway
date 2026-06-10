// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';

type Relayer = NonNullable<Chain['relayer']>;

// Defaults to a routable, non-GTF relayer type so that chains built via
// chainBuilder() route to a real relayer by default. Tests exercising the
// unroutable paths (`null` → 403, `GTF` → 501) must set `type` explicitly.
const ROUTABLE_RELAYER_TYPES: Array<Relayer['type']> = [
  RelayerType.RELAY_FEE,
  RelayerType.DAILY_LIMIT,
  RelayerType.NO_FEE_CAMPAIGN,
];

export function relayerBuilder(): IBuilder<Relayer> {
  return new Builder<Relayer>()
    .with('type', faker.helpers.arrayElement(ROUTABLE_RELAYER_TYPES))
    .with('safeCreationSponsored', faker.datatype.boolean())
    .with('safeTransactionSponsored', faker.datatype.boolean())
    .with('enableTenderlySimulationBeforeRelay', faker.datatype.boolean());
}
