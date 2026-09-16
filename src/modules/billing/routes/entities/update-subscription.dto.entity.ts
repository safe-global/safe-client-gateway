// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { OpaqueIdSchema } from '@/validation/entities/schemas/opaque-id.schema';

/**
 * No `prorationBehavior`: it is fixed server-side. `paymentLinkId` is only
 * needed to break a tie when several offered links carry the same price.
 */
export const UpdateSubscriptionSchema = z.object({
  planId: OpaqueIdSchema,
  paymentLinkId: OpaqueIdSchema.optional(),
});

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
}
