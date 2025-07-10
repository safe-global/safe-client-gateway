import { ApiProperty } from '@nestjs/swagger';
import type { UUID } from 'crypto';
import { DeleteAllSubscriptionsDto as DomainDeleteAllSubscriptionsDto } from '@/domain/notifications/v2/entities/delete-all-subscriptions.dto.entity';

export class DeleteAllSubscriptionItemDto {
  @ApiProperty()
  public readonly chainId!: string;

  @ApiProperty()
  public readonly deviceUuid!: UUID;

  @ApiProperty()
  public readonly safeAddress!: `0x${string}`;
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
  public readonly subscriptions!: Array<DeleteAllSubscriptionItemDto>;
}
