import { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UUID } from 'crypto';
import { z } from 'zod';

export const UpsertSubscriptionsDtoSafeSchema = z.object({
  chainId: z.string(),
  address: AddressSchema,
  notificationTypes: z.array(z.nativeEnum(NotificationType)),
});

export const UpsertSubscriptionsDtoSchema = z.object({
  cloudMessagingToken: z.string(),
  safes: z.array(UpsertSubscriptionsDtoSafeSchema),
  deviceType: z.nativeEnum(DeviceType),
  deviceUuid: UuidSchema.nullish().default(null),
});

export class UpsertSubscriptionsSafesDto
  implements z.infer<typeof UpsertSubscriptionsDtoSafeSchema>
{
  @ApiProperty()
  chainId!: string;

  @ApiProperty()
  address!: `0x${string}`;

  @ApiProperty({
    isArray: true,
    enum: NotificationType,
    enumName: 'NotificationType',
  })
  notificationTypes!: Array<NotificationType>;
}

export class UpsertSubscriptionsDto
  implements z.infer<typeof UpsertSubscriptionsDtoSchema>
{
  @ApiProperty()
  cloudMessagingToken!: string;

  @ApiProperty({ isArray: true, type: UpsertSubscriptionsSafesDto })
  safes!: Array<UpsertSubscriptionsSafesDto>;

  @ApiProperty({ enum: DeviceType, enumName: 'DeviceType' })
  deviceType!: DeviceType;

  @ApiPropertyOptional({ nullable: true, type: String })
  deviceUuid!: UUID;
}
