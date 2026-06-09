// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';

type Relayer = NonNullable<Chain['relayer']>;

export function relayerBuilder(): IBuilder<Relayer> {
  return new Builder<Relayer>()
    .with(
      'type',
      faker.helpers.arrayElement([
        ...Object.values(RelayerType),
        null,
      ]) as Relayer['type'],
    )
    .with('safeCreationSponsored', faker.datatype.boolean())
    .with('safeTransactionSponsored', faker.datatype.boolean())
    .with('enableTenderlySimulationBeforeRelay', faker.datatype.boolean());
}
