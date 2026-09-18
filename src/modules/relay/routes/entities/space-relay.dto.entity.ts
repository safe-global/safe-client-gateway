// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import type { z } from 'zod';
import { RelayDtoSchema } from '@/modules/relay/routes/entities/schemas/relay.dto.schema';

/**
 * The chain-scoped request without `gasLimit`: it is only ever read as the
 * no-fee campaign's declared ceiling, which this route does not apply, and a
 * new endpoint has no backward compatibility to keep it for. Derived rather
 * than restated so the fields that remain cannot drift apart.
 */
export const SpaceRelayDtoSchema = RelayDtoSchema.omit({ gasLimit: true });

export class SpaceRelayDto implements z.infer<typeof SpaceRelayDtoSchema> {
  @ApiProperty()
  version: string;

  @ApiProperty()
  to: Address;

  @ApiProperty()
  data: Hex;

  @ApiPropertyOptional({
    type: String,
    description:
      'Safe transaction hash, forwarded to the relay provider for traceability. Not verified against the calldata on this route.',
  })
  safeTxHash?: Hex;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Set to true to proceed with the relay when a previous attempt returned INDETERMINATE_SIMULATION. The user has acknowledged the simulation could not be completed and accepts the risk.',
  })
  acceptUnverifiedSimulation?: boolean;

  constructor(dto: z.infer<typeof SpaceRelayDtoSchema>) {
    this.version = dto.version;
    this.to = dto.to;
    this.data = dto.data;
    this.safeTxHash = dto.safeTxHash;
    this.acceptUnverifiedSimulation = dto.acceptUnverifiedSimulation;
  }
}
