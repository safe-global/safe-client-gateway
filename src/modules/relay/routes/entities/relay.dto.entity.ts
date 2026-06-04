// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import type { z } from 'zod';
import type { RelayDtoSchema } from '@/modules/relay/routes/entities/schemas/relay.dto.schema';

export class RelayDto implements z.infer<typeof RelayDtoSchema> {
  @ApiProperty()
  version: string;

  @ApiProperty()
  to: Address;

  @ApiProperty()
  data: Hex;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: `Accepted for backward compatibility and validation; not forwarded to the relay provider (Gelato).`,
  })
  gasLimit: bigint | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Safe transaction hash for relay-fee eligibility check',
  })
  safeTxHash?: Hex;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Set to true to proceed with the relay when a previous attempt returned INDETERMINATE_SIMULATION. The user has acknowledged the simulation could not be completed and accepts the risk.',
  })
  acceptUnverifiedSimulation?: boolean;

  constructor(dto: z.infer<typeof RelayDtoSchema>) {
    this.version = dto.version;
    this.to = dto.to;
    this.data = dto.data;
    this.gasLimit = dto.gasLimit;
    this.safeTxHash = dto.safeTxHash;
    this.acceptUnverifiedSimulation = dto.acceptUnverifiedSimulation;
  }
}
