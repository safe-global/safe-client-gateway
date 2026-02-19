import { DeviceType } from '@/modules/notifications/domain/v2/entities/device-type.entity';
import { NotificationType } from '@/modules/notifications/domain/v2/entities/notification-type.entity';
import {
  type UpsertSubscriptionsSafesDto as DomainUpsertSubscriptionsSafesDto,
  type UpsertSubscriptionsDto as DomainUpsertSubscriptionsDto,
} from '@/modules/notifications/domain/v2/entities/upsert-subscriptions.dto.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UUID } from 'crypto';
import type { Address } from 'viem';

export class UpsertSubscriptionsSafesDto implements DomainUpsertSubscriptionsSafesDto {
  @ApiProperty()
  chainId!: string;

  @ApiProperty()
  address!: Address;

  @ApiProperty({
    isArray: true,
    enum: NotificationType,
    enumName: 'NotificationTypeEnum',
  })
  notificationTypes!: Array<NotificationType>;
}

export class UpsertSubscriptionsDto implements DomainUpsertSubscriptionsDto {
  @ApiProperty()
  cloudMessagingToken!: string;

  @ApiProperty({ isArray: true, type: UpsertSubscriptionsSafesDto })
  safes!: Array<UpsertSubscriptionsSafesDto>;

  @ApiProperty({ enum: DeviceType, enumName: 'DeviceType' })
  deviceType!: DeviceType;

  @ApiPropertyOptional({ nullable: true, type: String })
  deviceUuid!: UUID;
}
