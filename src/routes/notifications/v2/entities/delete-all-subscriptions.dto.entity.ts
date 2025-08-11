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

  @ApiProperty({
    type: 'string',
    required: false,
    nullable: true,
    description:
      'Optional signer address filter:\n' +
      '• Omitted (undefined): Deletes subscriptions regardless of signer address\n' +
      '• null: Deletes only subscriptions with no signer address\n' +
      '• Valid address: Deletes only subscriptions with that specific signer address',
  })
  public readonly signerAddress?: `0x${string}` | null;
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
