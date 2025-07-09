import { ApiProperty } from '@nestjs/swagger';
import type { UUID } from 'crypto';
import { DeleteAllSubscriptionsDto as DomainDeleteAllSubscriptionsDto } from '@/domain/notifications/v2/entities/delete-all-subscriptions.dto.entity';

export class DeleteAllSubscriptionItemDto {
  @ApiProperty()
  chainId!: string;

  @ApiProperty()
  deviceUuid!: UUID;

  @ApiProperty()
  safeAddress!: `0x${string}`;
}

export class DeleteAllSubscriptionsDto
  implements DomainDeleteAllSubscriptionsDto
{
  @ApiProperty({
    isArray: true,
    type: DeleteAllSubscriptionItemDto,
    minItems: 1,
    description: 'At least one subscription is required',
  })
  subscriptions!: Array<DeleteAllSubscriptionItemDto>;
}
