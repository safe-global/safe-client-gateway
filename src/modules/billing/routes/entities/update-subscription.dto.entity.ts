// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { OpaqueIdSchema } from '@/validation/entities/schemas/opaque-id.schema';

const RemovedSafeSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

/**
 * No `prorationBehavior`: it is fixed server-side. `paymentLinkId` is only
 * needed to break a tie when several offered links carry the same price.
 */
export const UpdateSubscriptionSchema = z.object({
  planId: OpaqueIdSchema,
  paymentLinkId: OpaqueIdSchema.optional(),
  removedSafes: z.array(RemovedSafeSchema).optional(),
});

export class RemovedSafeDto implements z.infer<typeof RemovedSafeSchema> {
  @ApiProperty({ type: String })
  public readonly chainId!: string;

  @ApiProperty({ type: String })
  public readonly address!: Address;
}

export class UpdateSubscriptionDto
  implements z.infer<typeof UpdateSubscriptionSchema>
{
  @ApiProperty({
    description: 'The price id of the plan to move the subscription onto',
  })
  public readonly planId!: string;
  @ApiPropertyOptional({
    description:
      'Which offered payment link sells that plan. Only needed to disambiguate when several do',
  })
  public readonly paymentLinkId?: string;
  @ApiPropertyOptional({
    type: RemovedSafeDto,
    isArray: true,
    description:
      'Safes to remove from the workspace before the plan changes, so it fits the new plan. Safes the workspace does not hold are ignored',
  })
  public readonly removedSafes?: Array<RemovedSafeDto>;
}
