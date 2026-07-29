// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import type { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

const SeatSelectionSafeSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

/**
 * An empty `safes` array clears the explicit selection: coverage falls back
 * to the default order (oldest Safes first).
 */
export const UpdateSeatSelectionSchema = z.object({
  safes: z
    .array(SeatSelectionSafeSchema)
    .max(500)
    .refine(
      (safes) =>
        new Set(safes.map((safe) => `${safe.chainId}:${safe.address}`)).size ===
        safes.length,
      { message: 'Duplicate Safes in selection' },
    ),
});

export class SeatSelectionSafeDto
  implements z.infer<typeof SeatSelectionSafeSchema>
{
  @ApiProperty({ type: String })
  public readonly chainId!: SpaceSafe['chainId'];

  @ApiProperty({ type: String })
  public readonly address!: SpaceSafe['address'];
}

export class UpdateSeatSelectionDto
  implements z.infer<typeof UpdateSeatSelectionSchema>
{
  @ApiProperty({
    type: SeatSelectionSafeDto,
    isArray: true,
    description:
      'The Safes that keep the covered seats. Selecting fewer than the quota tops the remainder up oldest-first; an empty list restores the default (oldest-first) coverage.',
  })
  public readonly safes!: Array<SeatSelectionSafeDto>;
}
