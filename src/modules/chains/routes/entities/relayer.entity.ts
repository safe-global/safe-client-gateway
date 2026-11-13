// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Relayer as DomainRelayer } from '#/modules/chains/domain/entities/relayer.entity';
import { GasPaymentOption } from '#/modules/relay/domain/entities/gas-payment-option.entity';
import { RelayerType } from '#/modules/relay/domain/entities/relayer-type.entity';

export class Relayer implements DomainRelayer {
  @ApiProperty({ enum: RelayerType, nullable: true })
  type!: RelayerType | null;
  @ApiProperty()
  safeCreationSponsored!: boolean;
  @ApiProperty({
    deprecated: true,
    description: 'Use gasPaymentOptions instead.',
  })
  safeTransactionSponsored!: boolean;
  @ApiProperty()
  enableTenderlySimulationBeforeRelay!: boolean;
  @ApiProperty({
    enum: GasPaymentOption,
    isArray: true,
    description: 'Who may pay for a relayed transaction on this chain.',
  })
  gasPaymentOptions!: Array<GasPaymentOption>;
}
