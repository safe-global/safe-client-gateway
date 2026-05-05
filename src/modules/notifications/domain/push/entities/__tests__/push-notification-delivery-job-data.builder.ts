// SPDX-License-Identifier: FSL-1.1-MIT

import type { UUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { PushNotificationDeliveryJobData } from '@/modules/notifications/domain/push/entities/push-notification-job-data.entity';
import { NotificationType } from '@/modules/notifications/domain/v2/entities/notification.entity';

export function pushNotificationDeliveryJobDataBuilder(): IBuilder<PushNotificationDeliveryJobData> {
  const notificationType = faker.helpers.enumValue(NotificationType);
  return new Builder<PushNotificationDeliveryJobData>()
    .with('token', faker.string.alphanumeric(32))
    .with('deviceUuid', faker.string.uuid() as UUID)
    .with('notification', { data: { type: notificationType } })
    .with('chainId', faker.string.numeric())
    .with('safeAddress', getAddress(faker.finance.ethereumAddress()))
    .with('notificationType', notificationType);
}
