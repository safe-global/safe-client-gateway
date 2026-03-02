// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { RelayDtoSchema } from '@/modules/relay/routes/entities/schemas/relay.dto.schema';
import type { Address, Hex } from 'viem';

export class RelayDto implements z.infer<typeof RelayDtoSchema> {
  @ApiProperty()
  version!: string;

  @ApiProperty()
  to!: Address;

  @ApiProperty()
  data!: Hex;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: `Accepted for backward compatibility and validation; not forwarded to the relay provider (Gelato).`,
  })
  gasLimit!: bigint | null;
}
