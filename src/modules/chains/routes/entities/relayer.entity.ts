// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Chain as DomainChain } from '@/modules/chains/domain/entities/chain.entity';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';

type DomainRelayer = NonNullable<DomainChain['relayer']>;

/** The relayer as served to clients; `gasPaymentOptions` stays internal for now. */
export class Relayer implements Omit<DomainRelayer, 'gasPaymentOptions'> {
  @ApiProperty({ enum: RelayerType, nullable: true })
  type: RelayerType | null;
  @ApiProperty()
  safeCreationSponsored: boolean;
  @ApiProperty()
  safeTransactionSponsored: boolean;
  @ApiProperty()
  enableTenderlySimulationBeforeRelay: boolean;

  constructor(relayer: DomainRelayer) {
    this.type = relayer.type;
    this.safeCreationSponsored = relayer.safeCreationSponsored;
    this.safeTransactionSponsored = relayer.safeTransactionSponsored;
    this.enableTenderlySimulationBeforeRelay =
      relayer.enableTenderlySimulationBeforeRelay;
  }
}
