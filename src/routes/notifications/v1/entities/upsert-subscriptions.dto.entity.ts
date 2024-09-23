import { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { z } from 'zod';

export const UpsertSubscriptionsDtoSchema = z.object({
  cloudMessagingToken: z.string(),
  safes: z.array(
    z.object({
      chainId: z.string(),
      address: AddressSchema,
      notificationTypes: z.array(z.nativeEnum(NotificationType)),
    }),
  ),
  deviceType: z.nativeEnum(DeviceType),
  deviceUuid: UuidSchema.nullish().default(null),
});

export type UpsertSubscriptionsDto = z.infer<
  typeof UpsertSubscriptionsDtoSchema
>;
