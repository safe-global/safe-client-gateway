import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const DeleteSubscriptionsDtoSafesSchema = z.object({
  chainId: z.string(),
  address: AddressSchema,
});

export const DeleteSubscriptionsDtoSchema = z.object({
  safes: z.array(DeleteSubscriptionsDtoSafesSchema),
});

export class DeleteSubscriptionsSafesDto
  implements z.infer<typeof DeleteSubscriptionsDtoSafesSchema>
{
  @ApiProperty()
  chainId!: string;

  @ApiProperty()
  address!: `0x${string}`;
}

export class DeleteSubscriptionsDto
  implements z.infer<typeof DeleteSubscriptionsDtoSchema>
{
  @ApiProperty({ type: [DeleteSubscriptionsSafesDto] })
  safes!: Array<DeleteSubscriptionsSafesDto>;
}
